import { hashProvider, tokenProvider } from '@/common/composition-root';
import { userRepository } from '@/database/repositories';
import { UsersController } from './users.controller';
import { UserService } from './users.service';

const userService = new UserService(userRepository, hashProvider, tokenProvider);
export const usersController = new UsersController(userService);
