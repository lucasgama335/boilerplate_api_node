import { AppError } from '@/app/exceptions/AppError';
import { IHashProvider } from '@/app/infra/hashing/IHashProvider';
import { ITokenProvider } from '@/app/infra/token/ITokenProvider';
import { hashToken } from '@/app/utils/hash-token';
import { IUserRepository } from '@/modules/users/domain/IUserRepository';
import { User } from '@/modules/users/domain/User';
import crypto from 'node:crypto';
import { IRefreshTokenRepository } from '../domain/IRefreshTokenRepository';
import { AuthenticateUserDTO } from '../http/schemas/authenticate-user.schema';
import { RegisterUserDTO } from '../http/schemas/register-user-schema';

export class AuthenticateUserService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly refreshTokenRepository: IRefreshTokenRepository,
        private readonly hashProvider: IHashProvider,
        private readonly tokenProvider: ITokenProvider,
    ) {}

    async registerUser(data: RegisterUserDTO): Promise<User> {
        const userAlreadyExists = await this.userRepository.findByEmail(data.email);
        if (userAlreadyExists) {
            throw new AppError('Esse e-mail já está vinculado a uma conta cadastrada no sistema.', 409);
        }

        // Extraímos o 'password' e agrupamos o resto das propriedades na variável 'userData'
        const { password, ...userData } = data;

        const hashedPassword = await this.hashProvider.hash(data.password);

        const createdUser = await this.userRepository.create({
            ...userData, // Aqui vai apenas os campos limpos e sanitizados, sem o texto do password
            passwordHash: hashedPassword,
        });
        return createdUser;
    }

    async loginUser(data: AuthenticateUserDTO) {
        const { email, password } = data;

        const user = await this.userRepository.findByEmail(email, true);
        if (!user) {
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        const passwordMatch = await this.hashProvider.compare(password, user.passwordHash);
        if (!passwordMatch) {
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

        const { passwordHash, ...userWihoutPassword } = user;

        return {
            user: userWihoutPassword,
            token,
            refreshToken: rawRefreshToken,
        };
    }
}
