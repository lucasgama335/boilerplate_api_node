import { AppError } from '@/app/exceptions/AppError';
import { IHashProvider } from '@/app/infra/hashing/IHashProvider';
import { ITokenProvider } from '@/app/infra/token/ITokenProvider';
import { IUserRepository } from '@/modules/users/domain/IUserRepository';
import { User } from '@/modules/users/domain/User';
import { AuthenticateUserDTO } from '../http/schemas/authenticate-user.schema';
import { RegisterUserDTO } from '../http/schemas/register-user-schema';

export class AuthenticateUserService {
    constructor(
        private readonly userRepository: IUserRepository,
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
        const { passwordHash, ...userWihoutPassword } = user;

        return {
            user: userWihoutPassword,
            token,
        };
    }
}
