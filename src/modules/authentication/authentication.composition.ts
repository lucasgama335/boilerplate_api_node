import { geolocationProvider, hashProvider, tokenProvider, tokenValidityProvider, userAgentProvider } from '@/app/composition-root';
import { databaseInstance } from '@/database/index';
import { userRepository } from '@/modules/users/users.composition';

import { AuthenticateController } from './authentication.controller';
import { AuthenticateUserService } from './authentication.services';
import { LoginAttemptsRepository } from './login-attempts.repository';
import { DrizzleRefreshTokenRepository } from './refresh-tokens.repository';

const refreshTokenRepository = new DrizzleRefreshTokenRepository(databaseInstance);
const loginAttemptRepository = new LoginAttemptsRepository(databaseInstance);

const authenticateService = new AuthenticateUserService(
    userRepository,
    refreshTokenRepository,
    loginAttemptRepository,
    hashProvider,
    tokenProvider,
    geolocationProvider,
    userAgentProvider,
    tokenValidityProvider,
);

export const authenticateController = new AuthenticateController(authenticateService);
