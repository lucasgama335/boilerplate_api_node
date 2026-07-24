import { databaseInstance } from '@/database';
import { GetUserProfileService } from './application/GetUserProfileService';
import { ProfileController } from './http/controllers/ProfileController';
import { DrizzleUserRepository } from './infra/DrizzleUserRepository';

export const userRepository = new DrizzleUserRepository(databaseInstance);

const getUserProfileService = new GetUserProfileService(userRepository);
export const profileController = new ProfileController(getUserProfileService);
