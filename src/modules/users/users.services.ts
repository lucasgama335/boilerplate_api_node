import { AppError } from '@/app/exceptions/AppError';
import { User } from '@/modules/users/users.types';
import { IUserRepository } from './users.repository';

export class UserService {
    constructor(private readonly userRepository: IUserRepository) {}

    async getProfile(userId: string): Promise<User> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('Usuário não encontrado', 404);
        }
        return user;
    }
}
