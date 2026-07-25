import { Router } from 'express';

import { authMiddleware } from '@/app/composition-root';
import { authAccountRateLimiter, authIpRateLimiter } from '@/app/http/middlewares/rate-limiter.middleware';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { authenticateController } from './authentication.composition';
import { authenticateUserSchema, changePasswordUserSchema } from './authentication.schemas';

export const authRoutes = Router();

authRoutes.post('/login', authIpRateLimiter, authAccountRateLimiter, validateDataMiddleware(authenticateUserSchema), authenticateController.loginUser);
authRoutes.post('/refresh', authIpRateLimiter, authenticateController.refreshToken);
authRoutes.post('/change-password', authMiddleware, validateDataMiddleware(changePasswordUserSchema), authenticateController.changeAuthenthicatedUserPassword);
authRoutes.post('/logout', authenticateController.logout);
authRoutes.post('/logout-all-devices', authMiddleware, authenticateController.revokeAllUserTokens);
