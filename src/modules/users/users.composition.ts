import { databaseInstance } from '@/database';
import { ProfileController } from './users.controller';
import { DrizzleUserRepository } from './users.repository';
import { GetUserProfileService } from './users.services';

export const userRepository = new DrizzleUserRepository(databaseInstance);

const getUserProfileService = new GetUserProfileService(userRepository);
export const profileController = new ProfileController(getUserProfileService);
