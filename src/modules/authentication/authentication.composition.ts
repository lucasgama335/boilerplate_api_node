import { geolocationProvider, hashProvider, tokenProvider, userAgentProvider, userSessionRevocationProvider } from '@/common/composition-root';

import { authRateLimiter } from '@/common/http/middlewares/rate-limiter.middleware';
import { loginAttemptRepository, refreshTokenRepository, userRepository } from '@/database/repositories';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';

const authenticateService = new AuthenticationService(
    userRepository,
    refreshTokenRepository,
    loginAttemptRepository,
    hashProvider,
    tokenProvider,
    geolocationProvider,
    userAgentProvider,
    userSessionRevocationProvider,
    authRateLimiter,
);

export const authenticationController = new AuthenticationController(authenticateService);
