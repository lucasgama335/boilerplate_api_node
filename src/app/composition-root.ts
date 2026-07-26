// shared/composition-root.ts (ou onde você já centraliza infra compartilhada)
import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { GeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { HashProvider } from '@/app/infra/hashing/HashProvider';
import { redisClient } from '@/app/infra/redis/redis-client';
import { TokenProvider } from '@/app/infra/token/TokenProvider';
import { UserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { userPermissionsRepository, userRepository } from '@/database/repositories';
import { ensureAuthorizedMiddleware } from './http/middlewares/ensure-authorized-middleware';
import { ensureEmailConfirmedMiddleware } from './http/middlewares/ensure-email-confirmed-middleware';
import { UserPermissionsProvider } from './infra/user-permissions-provider/UserPermissionsProvider';
import { UserSessionsRevocationProvider } from './infra/user-sessions-revocation/UserSessionsRevocationProvider';

export const hashProvider = new HashProvider();
export const tokenProvider = new TokenProvider();
export const geolocationProvider = new GeolocationProvider();
export const userAgentProvider = new UserAgentProvider();
export const userSessionRevocationProvider = new UserSessionsRevocationProvider(userRepository, redisClient);
export const userPermissionsProvider = new UserPermissionsProvider(userPermissionsRepository, redisClient);

export const authMiddleware = ensureAuthenticatedMiddleware(tokenProvider, userSessionRevocationProvider);
export const emailConfirmationMiddleware = ensureEmailConfirmedMiddleware(userRepository);
export const authorize = (requiredPermissions: string[]) => ensureAuthorizedMiddleware(userPermissionsProvider, requiredPermissions);
