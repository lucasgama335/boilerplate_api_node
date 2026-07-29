import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { GeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { HashProvider } from '@/app/infra/hashing/HashProvider';
import { redisClient } from '@/app/infra/redis/redis-client';
import { TokenProvider } from '@/app/infra/token/TokenProvider';
import { UserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { userDepartmentsRepository, userPermissionsRepository, userRepository } from '@/database/repositories';
import { ensureAuthorizedMiddleware } from './http/middlewares/ensure-authorized-middleware';
import { ensureEmailConfirmedMiddleware } from './http/middlewares/ensure-email-confirmed-middleware';
import { UserPermissionsService } from './services/user-permissions/UserPermissionsService';
import { UserSessionsRevocationService } from './services/user-sessions-revocation/UserSessionsRevocationService';

export const hashProvider = new HashProvider();
export const tokenProvider = new TokenProvider();
export const geolocationProvider = new GeolocationProvider();
export const userAgentProvider = new UserAgentProvider();
export const userSessionRevocationProvider = new UserSessionsRevocationService(userRepository, redisClient);
export const userPermissionsService = new UserPermissionsService(userPermissionsRepository, userDepartmentsRepository, redisClient);

export const authMiddleware = ensureAuthenticatedMiddleware(tokenProvider, userSessionRevocationProvider);
export const emailConfirmationMiddleware = ensureEmailConfirmedMiddleware(userRepository);
export const authorize = (requiredPermissions: string[]) => ensureAuthorizedMiddleware(userPermissionsService, requiredPermissions);
