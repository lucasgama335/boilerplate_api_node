import { AppError } from '@/app/exceptions/AppError';
import { IGeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenValidityProvider } from '@/app/infra/token-validity/TokenValidityProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { IUserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { hashToken } from '@/app/utils/hash-token';
import { IUserRepository } from '@/modules/users/users.repository';
import { User } from '@/modules/users/users.types';
import crypto from 'node:crypto';
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
            // Registra tentativa de login
            await this.loginAttemptRepository.generateAttempt('fail', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user?.id);
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        // Gera novo token de acesso
        const token = this.tokenProvider.generate(user.id);

        // Gera um novo refresh token
        const rawRefreshToken = crypto.randomBytes(64).toString('hex');
        const hashedRefreshToken = hashToken(rawRefreshToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (Number(process.env.REFRESH_TOKEN_EXPIRES_AT) || 7));
        // expiresAt.setTime(expiresAt.getTime() + 10 * 1000);

        await this.refreshTokenRepository.create(user.id, hashedRefreshToken, expiresAt, ipAddress, location.city, location.region, location.country, device.os, device.deviceType);

        const { passwordHash: _, ...userWihoutPassword } = user;

        // Registra tentativa de login
        await this.loginAttemptRepository.generateAttempt('success', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user.id);

        return {
            user: userWihoutPassword,
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

        // Valida se já foi revogado
        if (tokenRecord.revoked) {
            // Dica de segurança avançada: Se um token revogado for tentado,
            // pode indicar roubo de token. Aqui poderíamos revogar todos os tokens do usuário.
            await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
            await this.tokenValidityProvider.revokeAllTokens(tokenRecord.userId);
            throw new AppError('Refresh token inválido ou já utilizado.', 401);
        }

        // Valida se expirou
        const ahora = new Date();
        if (ahora > new Date(tokenRecord.expiresAt)) {
            throw new AppError('Refresh token expirado.', 401);
        }

        // ROTAÇÃO DE TOKEN: Revoga o token atual para que não possa ser reutilizado
        await this.refreshTokenRepository.revokeToken(tokenRecord.id);

        // Gera um novo Access Token
        const accessToken = this.tokenProvider.generate(tokenRecord.userId);

        // Gera um novo Refresh Token (par de rotação)
        const newRawRefreshToken = crypto.randomBytes(64).toString('hex');
        const newHashedRefreshToken = hashToken(newRawRefreshToken);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (Number(process.env.REFRESH_TOKEN_EXPIRES_AT) || 7));
        // expiresAt.setTime(expiresAt.getTime() + 10 * 1000);

        const location = this.geolocationProvider.lookup(ipAddress);
        const device = this.userAgentProvider.parse(userAgentString);

        await this.refreshTokenRepository.create(
            tokenRecord.userId,
            newHashedRefreshToken,
            expiresAt,
            ipAddress,
            location.city,
            location.region,
            location.country,
            device.os,
            device.deviceType,
        );

        return { token: accessToken, refreshToken: newRawRefreshToken, refreshTokenExpiresAt: expiresAt };
    }

    async revokeByRawToken(token: string): Promise<void> {
        const hashedToken = hashToken(token);
        const tokenRecord = await this.refreshTokenRepository.findByTokenHash(hashedToken);
        if (!tokenRecord) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        // Valida se já foi revogado
        if (tokenRecord.revoked) {
            // Dica de segurança avançada: Se um token revogado for tentado,
            // pode indicar roubo de token. Aqui poderíamos revogar todos os tokens do usuário.
            await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
            await this.tokenValidityProvider.revokeAllTokens(tokenRecord.userId);
            throw new AppError('Refresh token inválido ou já utilizado.', 401);
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

    async registerUser(data: RegisterUserDTO): Promise<User> {
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
