import { AppError } from '@/app/exceptions/AppError';
import { IAuthRateLimiter } from '@/app/http/middlewares/rate-limiter.middleware';
import { IGeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { IUserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { IUserSessionsRevocationProvider } from '@/app/infra/user-sessions-revocation/UserSessionsRevocationProvider';
import { hashToken } from '@/app/utils/hash-token';
import { logger } from '@/app/utils/logger';
import { simulateHashDelay } from '@/app/utils/simulate-hash-delay';
import { env } from '@/env';
import { IUsersRepository } from '@/modules/users/repositories/users.repository';
import crypto from 'node:crypto';
import { SafeUser } from '../users/types/users.types';
import { ILoginAttemptsRepository } from './repositories/login-attempts.repository';
import { IRefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { AuthenticateUserDTO } from './schemas/authentication.schemas';

export class AuthenticationUserService {
    constructor(
        private readonly userRepository: IUsersRepository,
        private readonly refreshTokenRepository: IRefreshTokensRepository,
        private readonly loginAttemptsRepository: ILoginAttemptsRepository,
        private readonly hashProvider: IHashProvider,
        private readonly tokenProvider: ITokenProvider,
        private readonly geolocationProvider: IGeolocationProvider,
        private readonly userAgentProvider: IUserAgentProvider,
        private readonly userSessionRevocationProvider: IUserSessionsRevocationProvider,
        private readonly authRateLimiter: IAuthRateLimiter,
    ) {}

    async loginUser(data: AuthenticateUserDTO, ipAddress: string, userAgentString: string) {
        const { email, password } = data;

        const user = await this.userRepository.findByEmail(email, true);
        const location = this.geolocationProvider.lookup(ipAddress);
        const device = this.userAgentProvider.parse(userAgentString);

        // hash "dummy", nunca corresponde a senha nenhuma - só existe pra gastar o mesmo tempo de CPU
        const passwordMatch = await this.hashProvider.compare(password, user ? user.passwordHash : env.DUMMY_HASH);

        if (!user || !passwordMatch) {
            await this.loginAttemptsRepository.generateAttempt('fail', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user?.id);
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        if (!user.isEmailConfirmed) {
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        // Gera novo token de acesso
        const token = this.tokenProvider.generate(user.id);

        // Gera um novo refresh token
        const rawRefreshToken = crypto.randomBytes(64).toString('hex');
        const hashedRefreshToken = hashToken(rawRefreshToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_AT);

        await this.refreshTokenRepository.create(user.id, hashedRefreshToken, expiresAt, ipAddress, location.city, location.region, location.country, device.os, device.deviceType);

        const { passwordHash: _, ...userWithoutPassword } = user;

        await this.userRepository.updateLastLogin(user.id, new Date());
        await this.loginAttemptsRepository.generateAttempt('success', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user.id);

        // 🛡️ Reseta o rate limit de login (IP + conta) só quando o login é
        // efetivamente bem-sucedido — regra de negócio, por isso vive aqui
        // dentro do service, não no controller.
        await this.authRateLimiter.resetLoginLimits(ipAddress, email);

        return {
            user: userWithoutPassword,
            token,
            refreshToken: rawRefreshToken,
            refreshTokenExpiresAt: expiresAt,
        };
    }

    async refresh(rawToken: string, ipAddress: string, userAgentString: string) {
        if (!rawToken) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const hashedToken = hashToken(rawToken);
        const tokenRecord = await this.refreshTokenRepository.findByTokenHash(hashedToken);

        if (!tokenRecord) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const nowDate = new Date();

        // Valida se expirou por data de validade absoluta
        if (nowDate > new Date(tokenRecord.expiresAt)) {
            throw new AppError('Refresh token expirado.', 401);
        }

        // Valida se já foi revogado (Tratamento com Grace Period para concorrência)
        if (tokenRecord.revokedAt) {
            const diffInSeconds = (nowDate.getTime() - new Date(tokenRecord.revokedAt).getTime()) / 1000;

            // Se passou da janela de graça, é tentativa de roubo/reuso malicioso!
            if (diffInSeconds > env.GRACE_PERIOD_SECONDS) {
                await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
                await this.userSessionRevocationProvider.revokeAllTokens(tokenRecord.userId);
                throw new AppError('Sessão comprometida. Faça login novamente.', 401);
            }

            // Dentro da janela de graça: tolera a corrida legítima (retry de rede,
            // abas concorrentes usando o mesmo token quase ao mesmo tempo), mas NÃO
            // rotaciona de novo — só emite um novo access token. Se rotacionássemos
            // aqui, qualquer replay do token já revogado (inclusive por um atacante
            // que o tenha roubado antes da rotação original) geraria uma sessão nova
            // e persistente a cada tentativa dentro da janela, o que anula o
            // propósito da reuse detection durante esses segundos.
            logger.warn({ userId: tokenRecord.userId, refreshTokenId: tokenRecord.id, diffInSeconds }, 'Refresh token reutilizado dentro do grace period — rotação suprimida');

            const accessToken = this.tokenProvider.generate(tokenRecord.userId);
            return { accessToken, newRawRefreshToken: null, expiresAt: null };
        }

        // ROTAÇÃO DE TOKEN COM TRANSAÇÃO ATÔMICA
        const { accessToken, newRawRefreshToken, expiresAt } = await this.refreshTokenRepository.transaction(async (tx) => {
            await this.refreshTokenRepository.revokeToken(tokenRecord.id, tx);

            const newAccessToken = this.tokenProvider.generate(tokenRecord.userId);
            const rawRefresh = crypto.randomBytes(64).toString('hex');
            const hashedRefresh = hashToken(rawRefresh);
            const exp = new Date();
            exp.setDate(exp.getDate() + env.REFRESH_TOKEN_EXPIRES_AT);

            const locationInfo = this.geolocationProvider.lookup(ipAddress);
            const deviceInfo = this.userAgentProvider.parse(userAgentString);

            await this.refreshTokenRepository.create(
                tokenRecord.userId,
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
                accessToken: newAccessToken,
                newRawRefreshToken: rawRefresh,
                expiresAt: exp,
            };
        });

        return { accessToken, newRawRefreshToken, expiresAt };
    }

    async createResetPassword(email: string): Promise<void> {
        const user = await this.userRepository.findByEmail(email, true);

        // Paga o custo do hash sempre, exista o usuário ou não — é isso que de fato
        // equaliza o tempo de resposta entre os dois casos.
        await simulateHashDelay(this.hashProvider);

        if (!user) {
            return;
        }

        const { id, passwordHash, lastLoginAt } = user;
        const resetPasswordToken = this.tokenProvider.generatePasswordResetToken(id, passwordHash, lastLoginAt);
        if (env.NODE_ENV === 'development') {
            console.log(`🛡️ [FORGET PASSWORD - TOKEN]: ${resetPasswordToken}`);
        }
        // TODO: Chamar futuro Provedor de E-mail (ex: emailProvider.send(...))
        // Exemplo: await this.emailProvider.sendPasswordResetEmail(email, resetPasswordToken);
    }

    async resetPassword(resetPasswordToken: string, password: string): Promise<void> {
        const { sub: userId } = this.tokenProvider.decode(resetPasswordToken);
        const user = await this.userRepository.findById(userId, true);
        if (!user) {
            throw new AppError('Usuário inexistente.', 404);
        }

        try {
            this.tokenProvider.verifyPasswordResetToken(resetPasswordToken, user.passwordHash, user.lastLoginAt);
        } catch {
            throw new AppError('Token inválido e/ou expirado. Faça uma nova solicitação de token.', 401);
        }

        const hashedPassword = await this.hashProvider.hash(password);
        await this.userRepository.updatePassword(userId, hashedPassword, user.isEmailConfirmed);

        // 🛡️ Revoke all access tokens and refresh tokens from user
        await this.userSessionRevocationProvider.revokeAllTokens(userId);
        await this.refreshTokenRepository.revokeAllTokensByUser(userId);
    }

    async changeAuthenthicatedUserPassword(
        userId: string,
        newPassword: string,
        currentRefreshToken: string,
        oldPassword: string,
    ): Promise<{ user: SafeUser; accessToken: string }> {
        const user = await this.userRepository.findById(userId, true);
        if (!user) {
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        const matchOldPassword = await this.hashProvider.compare(oldPassword, user.passwordHash);
        if (!matchOldPassword) {
            throw new AppError('A senha atual está errada.', 401);
        }

        const hashedPassword = await this.hashProvider.hash(newPassword);
        const updatedUser = await this.userRepository.updatePassword(user.id, hashedPassword);

        await this.userSessionRevocationProvider.revokeAllTokens(userId);

        if (currentRefreshToken) {
            const hashedToken = hashToken(currentRefreshToken);
            await this.refreshTokenRepository.revokeAllTokensByUser(userId, hashedToken);
        } else {
            await this.refreshTokenRepository.revokeAllTokensByUser(userId);
        }

        const newAccessToken = this.tokenProvider.generate(userId);

        return { user: updatedUser, accessToken: newAccessToken };
    }

    async revokeByRawToken(token: string): Promise<void> {
        const hashedToken = hashToken(token);
        const tokenRecord = await this.refreshTokenRepository.findByTokenHash(hashedToken);
        if (!tokenRecord) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const nowDate = new Date();

        // Valida se já foi revogado
        if (tokenRecord.revokedAt) {
            const diffInSeconds = (nowDate.getTime() - new Date(tokenRecord.revokedAt).getTime()) / 1000;

            if (diffInSeconds > env.GRACE_PERIOD_SECONDS) {
                await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
                await this.userSessionRevocationProvider.revokeAllTokens(tokenRecord.userId);
                throw new AppError('Refresh token inválido ou já utilizado.', 401);
            }

            return;
        }

        await this.refreshTokenRepository.revokeToken(tokenRecord.id);
    }

    async revokeSessionsService(userId: string, keepCurrentSession: boolean, currentRefreshToken?: string) {
        // 1. Invalida todos os Access Tokens emitidos no passado (incluindo o da sessão atual)
        await this.userSessionRevocationProvider.revokeAllTokens(userId);

        if (keepCurrentSession && currentRefreshToken) {
            // 2A. Mantém apenas o Refresh Token atual vivo no banco
            const hashedToken = hashToken(currentRefreshToken);
            await this.refreshTokenRepository.revokeAllTokensByUser(userId, hashedToken);

            // 3. Como matamos todos os Access Tokens no passo 1, geramos um NOVO
            // com um timestamp superior à revogação, para a sessão atual não cair.
            const newAccessToken = this.tokenProvider.generate(userId);
            return { accessToken: newAccessToken };
        }

        // 2B. Destrói TODOS os Refresh Tokens do banco (Logout global absoluto)
        await this.refreshTokenRepository.revokeAllTokensByUser(userId);

        return { accessToken: null };
    }
}
