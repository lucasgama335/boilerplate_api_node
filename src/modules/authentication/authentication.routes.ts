import { Router } from 'express';

import { authMiddleware } from '@/app/composition-root';
import { authAccountRateLimiter, authIpRateLimiter } from '@/app/http/middlewares/rate-limiter.middleware';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { authenticateController } from './authentication.composition';
import { authenticateUserSchema, registerUserSchema } from './authentication.schemas';

export const authRoutes = Router();

authRoutes.post('/register', validateDataMiddleware(registerUserSchema), authenticateController.registerUser);
authRoutes.post('/login', authIpRateLimiter, authAccountRateLimiter, validateDataMiddleware(authenticateUserSchema), authenticateController.loginUser);
authRoutes.post('/refresh', authIpRateLimiter, authenticateController.refreshToken);
authRoutes.post('/logout', authenticateController.logout);
authRoutes.get('/logout-all-devices', authMiddleware, authenticateController.revokeAllUserTokens);
