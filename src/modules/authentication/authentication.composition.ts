import { geolocationProvider, hashProvider, tokenProvider, userAgentProvider, userSessionRevocationProvider } from '@/app/composition-root';

import { loginAttemptRepository, refreshTokenRepository, userRepository } from '@/database/repositories';
import { AuthenticateController } from './authentication.controller';
import { AuthenticationUserService } from './authentication.service';

const authenticateService = new AuthenticationUserService(
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
