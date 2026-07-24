// shared/composition-root.ts (ou onde você já centraliza infra compartilhada)
import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { TokenProvider } from '@/app/infra/token/TokenProvider';
import { HashProvider } from './infra/hashing/HashProvider';

export const hashProvider = new HashProvider();
export const tokenProvider = new TokenProvider();
export const authMiddleware = ensureAuthenticatedMiddleware(tokenProvider);
