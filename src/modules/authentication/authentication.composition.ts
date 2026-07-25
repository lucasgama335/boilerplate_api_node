import { geolocationProvider, hashProvider, tokenProvider, userAgentProvider, userSessionRevocationProvider } from '@/app/composition-root';

import { loginAttemptRepository, refreshTokenRepository, userRepository } from '@/database/repositories';
import { AuthenticateController } from './authentication.controller';
import { AuthenticateUserService } from './authentication.services';

const authenticateService = new AuthenticateUserService(
    userRepository,
    refreshTokenRepository,
    loginAttemptRepository,
    hashProvider,
    tokenProvider,
    geolocationProvider,
    userAgentProvider,
    userSessionRevocationProvider,
);

export const authenticateController = new AuthenticateController(authenticateService);
