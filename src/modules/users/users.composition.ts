import { hashProvider } from '@/app/composition-root';
import { userRepository } from '@/database/repositories';
import { UsersController } from './users.controller';
import { UserService } from './users.services';

const userService = new UserService(userRepository, hashProvider);
export const usersController = new UsersController(userService);
