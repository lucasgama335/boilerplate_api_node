import { AppError } from '@/app/exceptions/AppError';
import { IGeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenValidityProvider } from '@/app/infra/token-validity/TokenValidityProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { IUserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { hashToken } from '@/app/utils/hash-token';
import { env } from '@/env';
import { IUserRepository } from '@/modules/users/users.repository';
import crypto from 'node:crypto';
import { SafeUser } from '../users/users.types';
import { AuthenticateUserDTO, RegisterUserDTO } from './authentication.schemas';
import { ILoginAttemptsRepository } from './login-attempts.repository';
import { IRefreshTokenRepository } from './refresh-tokens.repository';

export class AuthenticateUserService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly refreshTokenRepository: IRefreshTokenRepository,
        private readonly loginAttemptRepository: ILoginAttemptsRepository,
        private readonly hashProvider: IHashProvider,
        private readonly tokenProvider: ITokenProvider,
        private readonly geolocationProvider: IGeolocationProvider,
        private readonly userAgentProvider: IUserAgentProvider,
        private readonly tokenValidityProvider: ITokenValidityProvider,
    ) {}

    async loginUser(data: AuthenticateUserDTO, ipAddress: string, userAgentString: string) {
        const { email, password } = data;

        const user = await this.userRepository.findByEmail(email, true);
        const location = this.geolocationProvider.lookup(ipAddress);
        const device = this.userAgentProvider.parse(userAgentString);

        // hash "dummy", nunca corresponde a senha nenhuma - só existe pra gastar o mesmo tempo de CPU
        const DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$ov2rVR+AcpuDLmUn6skwHg$trsz7jJNUnKjVWSAz862t7wFWgcT1Z19LgXgITvZH7c';
        const passwordMatch = await this.hashProvider.compare(password, user ? user.passwordHash : DUMMY_HASH);

        if (!user || !passwordMatch) {
            await this.loginAttemptRepository.generateAttempt('fail', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user?.id);
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

        await this.loginAttemptRepository.generateAttempt('success', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user.id);

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
            const GRACE_PERIOD_SECONDS = 20;

            // Se passou da janela de graça, é tentativa de roubo/reuso malicioso!
            if (diffInSeconds > GRACE_PERIOD_SECONDS) {
                await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
                await this.tokenValidityProvider.revokeAllTokens(tokenRecord.userId);
                throw new AppError('Sessão comprometida. Faça login novamente.', 401);
            }
        }

        // ROTAÇÃO DE TOKEN COM TRANSAÇÃO ATÔMICA
        const { accessToken, newRawRefreshToken, expiresAt } = await this.refreshTokenRepository.transaction(async (tx) => {
            if (!tokenRecord.revokedAt) {
                await this.refreshTokenRepository.revokeToken(tokenRecord.id, tx);
            }

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
            const GRACE_PERIOD_SECONDS = 20;

            if (diffInSeconds > GRACE_PERIOD_SECONDS) {
                await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
                await this.tokenValidityProvider.revokeAllTokens(tokenRecord.userId);
                throw new AppError('Refresh token inválido ou já utilizado.', 401);
            }
        }

        await this.refreshTokenRepository.revokeToken(tokenRecord.id);
    }

    async revokeSessionsService(userId: string, keepCurrentSession: boolean, currentRefreshToken?: string) {
        // 1. Invalida todos os Access Tokens emitidos no passado (incluindo o da sessão atual)
        await this.tokenValidityProvider.revokeAllTokens(userId);

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

    async registerUser(data: RegisterUserDTO): Promise<SafeUser> {
        const userAlreadyExists = await this.userRepository.findByEmail(data.email);
        if (userAlreadyExists) {
            throw new AppError('Esse e-mail já está vinculado a uma conta cadastrada no sistema.', 409);
        }

        // Extraímos o 'password' e agrupamos o resto das propriedades na variável 'userData'
        const { password: _, ...userData } = data;

        const hashedPassword = await this.hashProvider.hash(data.password);

        const createdUser = await this.userRepository.create({
            ...userData,
            passwordHash: hashedPassword,
        });
        return createdUser;
    }
}
