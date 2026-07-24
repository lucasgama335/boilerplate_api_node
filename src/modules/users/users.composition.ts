import { databaseInstance } from '@/database';
import { ProfileController } from './users.controller';
import { DrizzleUserRepository } from './users.repository';
import { UserService } from './users.services';

export const userRepository = new DrizzleUserRepository(databaseInstance);

const userService = new UserService(userRepository);
export const profileController = new ProfileController(userService);
