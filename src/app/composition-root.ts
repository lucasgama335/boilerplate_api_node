// shared/composition-root.ts (ou onde você já centraliza infra compartilhada)
import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { JwtTokenProvider } from '@/app/infra/token/JwtTokenProvider';
import { Argon2HashProvider } from './infra/hashing/Argon2HashProvider';

export const hashProvider = new Argon2HashProvider();
export const tokenProvider = new JwtTokenProvider();
export const authMiddleware = ensureAuthenticatedMiddleware(tokenProvider);
