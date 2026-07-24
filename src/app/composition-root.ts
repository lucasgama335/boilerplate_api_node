// shared/composition-root.ts (ou onde você já centraliza infra compartilhada)
import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { GeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { HashProvider } from '@/app/infra/hashing/HashProvider';
import { TokenProvider } from '@/app/infra/token/TokenProvider';
import { UserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { userRepository } from '@/modules/users/users.composition';
import { TokenValidityProvider } from './infra/token-validity/TokenValidityProvider';

export const hashProvider = new HashProvider();
export const tokenProvider = new TokenProvider();
export const geolocationProvider = new GeolocationProvider();
export const userAgentProvider = new UserAgentProvider();
export const tokenValidityProvider = new TokenValidityProvider(userRepository);

export const authMiddleware = ensureAuthenticatedMiddleware(tokenProvider, tokenValidityProvider);
