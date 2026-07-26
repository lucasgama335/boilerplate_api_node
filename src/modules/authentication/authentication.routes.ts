import { Router } from 'express';

import { authMiddleware } from '@/app/composition-root';
import {
    changePasswordRequestIdLimiter,
    forgotPasswordRequestEmailLimiter,
    forgotPasswordRequestIpLimiter,
    loginRequestEmailLimiter,
    loginRequestIpLimiter,
    refreshRequestIpLimiter,
    resetPasswordRequestIpLimiter,
} from '@/app/http/middlewares/rate-limiter.middleware';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { authenticateController } from './authentication.composition';
import { authenticateUserSchema, changePasswordUserSchema, forgotPasswordSchema, resetPasswordSchema } from './schemas/authentication.schemas';

export const authRoutes = Router();

authRoutes.post('/login', loginRequestIpLimiter, loginRequestEmailLimiter, validateDataMiddleware(authenticateUserSchema), authenticateController.loginUser);
authRoutes.post('/refresh', refreshRequestIpLimiter, authenticateController.refreshToken);
authRoutes.post(
    '/forgot-password',
    forgotPasswordRequestIpLimiter,
    forgotPasswordRequestEmailLimiter,
    validateDataMiddleware(forgotPasswordSchema),
    authenticateController.forgotPassword,
);
authRoutes.post('/reset-password', resetPasswordRequestIpLimiter, validateDataMiddleware(resetPasswordSchema), authenticateController.resetPassword);
authRoutes.post(
    '/change-password',
    authMiddleware,
    changePasswordRequestIdLimiter,
    validateDataMiddleware(changePasswordUserSchema),
    authenticateController.changeAuthenthicatedUserPassword,
);
authRoutes.post('/logout', authMiddleware, authenticateController.logout);
authRoutes.post('/logout-all-devices', authMiddleware, authenticateController.revokeAllUserTokens);
