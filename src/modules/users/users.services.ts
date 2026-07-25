import { AppError } from '@/app/exceptions/AppError';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { SafeUser } from '@/modules/users/users.types';
import { IUserRepository } from './users.repository';
import { RegisterUserDTO } from './users.schema';

export class UserService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly hashProvider: IHashProvider,
    ) {}

    async getProfile(userId: string): Promise<SafeUser> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('Usuário não encontrado', 404);
        }
        return user;
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
