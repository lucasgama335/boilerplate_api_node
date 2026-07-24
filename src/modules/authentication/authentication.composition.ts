import { hashProvider, tokenProvider } from '@/app/composition-root';
import { databaseInstance } from '@/database/index';
import { userRepository } from '@/modules/users/users.composition'; // reaproveita, não recria

import { AuthenticateController } from './authentication.controller';
import { AuthenticateUserService } from './authentication.services';
import { LoginAttemptsRepository } from './login-attempts.repository';
import { DrizzleRefreshTokenRepository } from './refresh-tokens.repository';

const refreshTokenRepository = new DrizzleRefreshTokenRepository(databaseInstance);
const loginAttemptRepository = new LoginAttemptsRepository(databaseInstance);

const authenticateService = new AuthenticateUserService(userRepository, refreshTokenRepository, hashProvider, tokenProvider, loginAttemptRepository);

export const authenticateController = new AuthenticateController(authenticateService);
