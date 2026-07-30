import { ensureAuthenticatedMiddleware } from '@/common/http/middlewares/ensure-authenticated-middleware';
import { GeoipLiteProvider } from '@/common/infra/providers/geo-location.provider';
import { Argon2Provider } from '@/common/infra/providers/hash.provider';
import { JsonWebTokenProvider } from '@/common/infra/providers/token.provider';
import { UaParserJsProvider } from '@/common/infra/providers/user-agent.provider';
import { redisClient } from '@/common/infra/redis-client.provider';
import { userDepartmentsRepository, userPermissionsRepository, userRepository } from '@/database/repositories';
import { PermissionCode } from '@/modules/permissions/constants/permission-codes';
import { UserSessionsRevocationProvider } from '../modules/authentication/providers/authentication.provider';
import { UserPermissionsProvider } from '../modules/user-access/providers/user-access.provider';
import { ensureAuthorizedMiddleware } from './http/middlewares/ensure-authorized-middleware';
import { ensureEmailConfirmedMiddleware } from './http/middlewares/ensure-email-confirmed-middleware';

export const hashProvider = new Argon2Provider();
export const tokenProvider = new JsonWebTokenProvider();
export const geolocationProvider = new GeoipLiteProvider();
export const userAgentProvider = new UaParserJsProvider();
export const userSessionRevocationProvider = new UserSessionsRevocationProvider(userRepository, redisClient);
export const userPermissionsProvider = new UserPermissionsProvider(userPermissionsRepository, userDepartmentsRepository, redisClient);

export const authMiddleware = ensureAuthenticatedMiddleware(tokenProvider, userSessionRevocationProvider);
export const emailConfirmationMiddleware = ensureEmailConfirmedMiddleware(userRepository);
export const authorize = (requiredPermissions: PermissionCode[]) => ensureAuthorizedMiddleware(userPermissionsProvider, requiredPermissions);
