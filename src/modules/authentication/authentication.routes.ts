import { Router } from 'express';

import { authMiddleware, emailConfirmationMiddleware } from '@/app/composition-root';
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
import { authenticationController } from './authentication.composition';
import { authenticateUserSchema, changePasswordUserSchema, forgotPasswordSchema, logoutAllDevicesSchema, resetPasswordSchema } from './schemas/authentication.schemas';

export const authRoutes = Router();

authRoutes.post('/login', loginRequestIpLimiter, loginRequestEmailLimiter, validateDataMiddleware(authenticateUserSchema), authenticationController.loginUser);
authRoutes.post('/refresh', refreshRequestIpLimiter, authenticationController.refreshToken);
authRoutes.post(
    '/forgot-password',
    forgotPasswordRequestIpLimiter,
    forgotPasswordRequestEmailLimiter,
    validateDataMiddleware(forgotPasswordSchema),
    authenticationController.forgotPassword,
);
authRoutes.post('/reset-password', resetPasswordRequestIpLimiter, validateDataMiddleware(resetPasswordSchema), authenticationController.resetPassword);
authRoutes.post(
    '/change-password',
    authMiddleware,
    emailConfirmationMiddleware,
    changePasswordRequestIdLimiter,
    validateDataMiddleware(changePasswordUserSchema),
    authenticationController.changeAuthenticatedUserPassword,
);
authRoutes.post('/logout', authMiddleware, authenticationController.logout);
authRoutes.post('/logout-all-devices', authMiddleware, validateDataMiddleware(logoutAllDevicesSchema), authenticationController.revokeAllUserTokens);
