// shared/composition-root.ts (ou onde você já centraliza infra compartilhada)
import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { GeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { HashProvider } from '@/app/infra/hashing/HashProvider';
import { redisClient } from '@/app/infra/redis/redis-client';
import { TokenProvider } from '@/app/infra/token/TokenProvider';
import { UserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { userRepository } from '@/database/repositories';
import { UserSessionRevocationProvider } from './infra/user-session-revocation/UserSessionRevocationProvider';

export const hashProvider = new HashProvider();
export const tokenProvider = new TokenProvider();
export const geolocationProvider = new GeolocationProvider();
export const userAgentProvider = new UserAgentProvider();
export const userSessionRevocationProvider = new UserSessionRevocationProvider(userRepository, redisClient);

export const authMiddleware = ensureAuthenticatedMiddleware(tokenProvider, userSessionRevocationProvider);
