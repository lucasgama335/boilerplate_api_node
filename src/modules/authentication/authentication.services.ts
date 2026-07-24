import { AppError } from '@/app/exceptions/AppError';
import { IHashProvider } from '@/app/infra/hashing/IHashProvider';
import { ITokenProvider } from '@/app/infra/token/ITokenProvider';
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
        private readonly hashProvider: IHashProvider,
        private readonly tokenProvider: ITokenProvider,
        private readonly loginAttemptRepository: ILoginAttemptsRepository,
    ) {}

    async loginUser(data: AuthenticateUserDTO, ipAddress: string) {
        const { email, password } = data;

        const user = await this.userRepository.findByEmail(email, true);

        // hash "dummy", nunca corresponde a senha nenhuma - só existe pra gastar o mesmo tempo de CPU
        const DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$ov2rVR+AcpuDLmUn6skwHg$trsz7jJNUnKjVWSAz862t7wFWgcT1Z19LgXgITvZH7c';
        const passwordMatch = await this.hashProvider.compare(password, user ? user.passwordHash : DUMMY_HASH);

        if (!user || !passwordMatch) {
            await this.loginAttemptRepository.generateAttempt('fail', ipAddress, email, user?.id);
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        const token = this.tokenProvider.generate(user.id);

        // Gera um novo refresh token
        const rawRefreshToken = crypto.randomBytes(64).toString('hex');
        const hashedRefreshToken = hashToken(rawRefreshToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (Number(process.env.REFRESH_TOKEN_EXPIRES_AT) || 7));
        // expiresAt.setTime(expiresAt.getTime() + 10 * 1000);

        await this.refreshTokenRepository.create(user.id, hashedRefreshToken, expiresAt);

        const { passwordHash: _, ...userWihoutPassword } = user;

        await this.loginAttemptRepository.generateAttempt('success', ipAddress, email, user.id);

        return {
            user: userWihoutPassword,
            token,
            refreshToken: rawRefreshToken,
            refreshTokenExpiresAt: expiresAt,
        };
    }

    async refresh(rawToken: string) {
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

        await this.refreshTokenRepository.create(tokenRecord.userId, newHashedRefreshToken, expiresAt);

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
            throw new AppError('Refresh token inválido ou já utilizado.', 401);
        }

        await this.refreshTokenRepository.revokeToken(tokenRecord.id);
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
            ...userData, // Aqui vai apenas os campos limpos e sanitizados, sem o texto do password
            passwordHash: hashedPassword,
        });
        return createdUser;
    }
}
