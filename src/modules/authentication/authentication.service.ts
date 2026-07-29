import { AppError } from '@/app/exceptions/AppError';
import { IAuthRateLimiter } from '@/app/http/middlewares/rate-limiter.middleware';
import { IGeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { IUserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { IUserSessionsRevocationService } from '@/app/services/user-sessions-revocation/UserSessionsRevocationService';
import { hashToken } from '@/app/utils/hash-token';
import { logger } from '@/app/utils/logger';
import { simulateHashDelay } from '@/app/utils/simulate-hash-delay';
import { env } from '@/env';
import { IUsersRepository } from '@/modules/users/repositories/users.repository';
import crypto from 'node:crypto';
import { SafeUser, toSafeUser } from '../users/types/users.types';
import { ILoginAttemptsRepository } from './repositories/login-attempts.repository';
import { IRefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { AuthenticateUserDTO } from './schemas/authentication.schemas';

export class AuthenticationService {
    constructor(
        private readonly userRepository: IUsersRepository,
        private readonly refreshTokenRepository: IRefreshTokensRepository,
        private readonly loginAttemptsRepository: ILoginAttemptsRepository,
        private readonly hashProvider: IHashProvider,
        private readonly tokenProvider: ITokenProvider,
        private readonly geolocationProvider: IGeolocationProvider,
        private readonly userAgentProvider: IUserAgentProvider,
        private readonly userSessionRevocationService: IUserSessionsRevocationService,
        private readonly authRateLimiter: IAuthRateLimiter,
    ) {}

    async loginUser(
        data: AuthenticateUserDTO,
        ipAddress: string,
        userAgentString: string,
    ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string; refreshTokenExpiresAt: Date }> {
        const { email, password } = data;

        const user = await this.userRepository.findByEmail(email);
        const location = this.geolocationProvider.lookup(ipAddress);
        const device = this.userAgentProvider.parse(userAgentString);
        const passwordMatch = await this.hashProvider.compare(password, user ? user.passwordHash : env.DUMMY_HASH); // 🛡️ Segurança contra time attacking

        if (!user || !passwordMatch) {
            await this.loginAttemptsRepository.generateAttempt('fail', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user?.id);
            throw new AppError('E-mail ou senha inválidos.', 401);
        }
        if (!user.isEmailConfirmed) {
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        // Gera os novos tokens (accessToken e refreshToken)
        const accessToken = this.tokenProvider.generate(user.id);
        const rawRefreshToken = crypto.randomBytes(64).toString('hex');
        const hashedRefreshToken = hashToken(rawRefreshToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_AT);

        await this.refreshTokenRepository.create(user.id, hashedRefreshToken, expiresAt, ipAddress, location.city, location.region, location.country, device.os, device.deviceType);
        await this.userRepository.updateLastLogin(user.id, new Date());
        await this.loginAttemptsRepository.generateAttempt('success', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user.id);
        await this.authRateLimiter.resetLoginLimits(ipAddress, email); // 🛡️ Reseta o rate limit de login (IP + conta)

        return {
            user: toSafeUser(user),
            accessToken,
            refreshToken: rawRefreshToken,
            refreshTokenExpiresAt: expiresAt,
        };
    }

    async refresh(rawToken: string, ipAddress: string, userAgentString: string): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }> {
        if (!rawToken) throw new AppError('Refresh token não encontrado.', 401);

        const refreshTokenCurrentlyInUse = await this.refreshTokenRepository.findByTokenHash(hashToken(rawToken));

        if (!refreshTokenCurrentlyInUse) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const nowDate = new Date();
        if (nowDate > new Date(refreshTokenCurrentlyInUse.expiresAt)) {
            throw new AppError('Refresh token expirado.', 401);
        }

        // Valida se já foi revogado (Tratamento com Grace Period para concorrência)
        if (refreshTokenCurrentlyInUse.revokedAt) {
            const diffInSeconds = (nowDate.getTime() - new Date(refreshTokenCurrentlyInUse.revokedAt).getTime()) / 1000;
            // Se passou da janela de graça, é tentativa de roubo/reuso malicioso!
            if (diffInSeconds > env.GRACE_PERIOD_SECONDS) {
                await this.refreshTokenRepository.revokeAllTokensByUser(refreshTokenCurrentlyInUse.userId);
                await this.userSessionRevocationService.revokeAllTokens(refreshTokenCurrentlyInUse.userId);
                throw new AppError('Sessão comprometida. Faça login novamente.', 401);
            }

            // Dentro da janela de graça: tolera a corrida legítima (retry de rede,
            // abas concorrentes usando o mesmo token quase ao mesmo tempo), mas NÃO
            // rotaciona de novo — só emite um novo access token. Se rotacionássemos
            // aqui, qualquer replay do token já revogado (inclusive por um atacante
            // que o tenha roubado antes da rotação original) geraria uma sessão nova
            // e persistente a cada tentativa dentro da janela, o que anula o
            // propósito da reuse detection durante esses segundos.
            logger.warn(
                { userId: refreshTokenCurrentlyInUse.userId, refreshTokenId: refreshTokenCurrentlyInUse.id, diffInSeconds },
                'Refresh token reutilizado dentro do grace period — rotação suprimida',
            );

            const accessToken = this.tokenProvider.generate(refreshTokenCurrentlyInUse.userId);
            return { accessToken, refreshToken: null, expiresAt: null };
        }

        // ROTAÇÃO DE TOKEN COM TRANSAÇÃO ATÔMICA
        const { accessToken, refreshToken, expiresAt } = await this.refreshTokenRepository.transaction(async (tx) => {
            const locationInfo = this.geolocationProvider.lookup(ipAddress);
            const deviceInfo = this.userAgentProvider.parse(userAgentString);
            const { id: refreshTokenCurrentlyInUseId, userId } = refreshTokenCurrentlyInUse;

            // Inutiliza o refreshToken atual
            await this.refreshTokenRepository.revokeToken(refreshTokenCurrentlyInUseId, tx);

            // Gera os novos tokens (accessToken e refreshToken)
            const accessToken = this.tokenProvider.generate(userId);
            const rawRefresh = crypto.randomBytes(64).toString('hex');
            const hashedRefresh = hashToken(rawRefresh);
            const exp = new Date();
            exp.setDate(exp.getDate() + env.REFRESH_TOKEN_EXPIRES_AT);

            await this.refreshTokenRepository.create(
                userId,
                hashedRefresh,
                exp,
                ipAddress,
                locationInfo.city,
                locationInfo.region,
                locationInfo.country,
                deviceInfo.os,
                deviceInfo.deviceType,
                tx,
            );

            return {
                accessToken,
                refreshToken: rawRefresh,
                expiresAt: exp,
            };
        });

        return { accessToken, refreshToken, expiresAt };
    }

    async createResetPassword(email: string): Promise<void> {
        const user = await this.userRepository.findByEmail(email);
        await simulateHashDelay(this.hashProvider); // 🛡️ Segurança contra time attacking

        if (!user) {
            return;
        }

        const resetPasswordToken = this.tokenProvider.generatePasswordResetToken(user.id, user.passwordHash, user.lastLoginAt);

        if (env.NODE_ENV === 'development') {
            console.log(`🛡️ [FORGET PASSWORD - TOKEN]: ${resetPasswordToken}`);
        }

        // TODO: Chamar futuro Provedor de E-mail
    }

    async resetPassword(resetPasswordToken: string, password: string): Promise<void> {
        const decoded = this.tokenProvider.decode(resetPasswordToken);
        if (!decoded || !decoded.sub) {
            throw new AppError('Token inválido ou malformado.', 401);
        }

        const userId = decoded.sub;
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new AppError('Usuário inexistente.', 404);
        }

        try {
            this.tokenProvider.verifyPasswordResetToken(resetPasswordToken, user.passwordHash, user.lastLoginAt);
        } catch {
            throw new AppError('Token inválido e/ou expirado. Faça uma nova solicitação de token.', 401);
        }

        const hashedPassword = await this.hashProvider.hash(password);
        // Atualiza a senha do usuário e revoga todos os token de acesso e refreshTokens
        await this.userRepository.updatePassword(userId, hashedPassword, user.isEmailConfirmed);
        await this.userSessionRevocationService.revokeAllTokens(userId);
        await this.refreshTokenRepository.revokeAllTokensByUser(userId);
    }

    async changeAuthenticatedUserPassword(userId: string, newPassword: string, currentRefreshToken: string, oldPassword: string): Promise<{ user: SafeUser; accessToken: string }> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        const matchOldPassword = await this.hashProvider.compare(oldPassword, user.passwordHash);
        if (!matchOldPassword) {
            throw new AppError('A senha atual está errada.', 401);
        }

        // Atualiza a senha do usuário e revoga os tokens de acesso
        const hashedPassword = await this.hashProvider.hash(newPassword);
        const updatedUser = await this.userRepository.updatePassword(user.id, hashedPassword);
        await this.userSessionRevocationService.revokeAllTokens(userId);

        // Se foi informado um currentRefreshToken a se preservado revoga todos os refreshToken que não o informado, salvando a sessão atual do usuário
        if (currentRefreshToken) {
            const hashedToken = hashToken(currentRefreshToken);
            await this.refreshTokenRepository.revokeAllTokensByUser(userId, hashedToken);
        } else {
            await this.refreshTokenRepository.revokeAllTokensByUser(userId);
        }

        // Gera o token de acesso
        const accessToken = this.tokenProvider.generate(userId);

        return { user: toSafeUser(updatedUser), accessToken };
    }

    async revokeByRawToken(token: string): Promise<void> {
        const hashedToken = hashToken(token);
        const tokenRecord = await this.refreshTokenRepository.findByTokenHash(hashedToken);
        if (!tokenRecord) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const nowDate = new Date();
        if (tokenRecord.revokedAt) {
            const diffInSeconds = (nowDate.getTime() - new Date(tokenRecord.revokedAt).getTime()) / 1000;
            if (diffInSeconds > env.GRACE_PERIOD_SECONDS) {
                await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
                await this.userSessionRevocationService.revokeAllTokens(tokenRecord.userId);
                throw new AppError('Refresh token inválido ou já utilizado.', 401);
            }

            return;
        }

        await this.refreshTokenRepository.revokeToken(tokenRecord.id);
    }

    async revokeSessionsService(userId: string, keepCurrentSession: boolean, currentRefreshToken?: string): Promise<{ accessToken: string | null }> {
        // Invalida todos os Access Tokens emitidos no passado (incluindo o da sessão atual)
        await this.userSessionRevocationService.revokeAllTokens(userId);

        if (keepCurrentSession && currentRefreshToken) {
            // Mantém apenas o Refresh Token atual vivo no banco
            const hashedToken = hashToken(currentRefreshToken);
            await this.refreshTokenRepository.revokeAllTokensByUser(userId, hashedToken);

            // Como matamos todos os Access Tokens no passo 1, geramos um NOVO
            // com um timestamp superior à revogação, para a sessão atual não cair.
            const newAccessToken = this.tokenProvider.generate(userId);
            return { accessToken: newAccessToken };
        }

        // Destrói TODOS os Refresh Tokens do banco (Logout global absoluto)
        await this.refreshTokenRepository.revokeAllTokensByUser(userId);

        return { accessToken: null };
    }
}
