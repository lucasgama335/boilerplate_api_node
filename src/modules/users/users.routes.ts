import { authMiddleware, emailConfirmationMiddleware } from '@/app/composition-root';
import { authAccountRateLimiter, authIpRateLimiter } from '@/app/http/middlewares/rate-limiter.middleware';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { env } from '@/env';
import { Router } from 'express';
import { usersController } from './users.composition';
import { confirmEmailSchema, registerUserSchema, resendConfirmationEmailSchema } from './users.schema';

export const userRoutes = Router();

userRoutes.get('/me', authMiddleware, emailConfirmationMiddleware, usersController.showProfile);
userRoutes.post('/register', validateDataMiddleware(registerUserSchema), usersController.registerUser);
userRoutes.post('/confirm-email', validateDataMiddleware(confirmEmailSchema), usersController.confirmEmail);
userRoutes.post(
    '/resend-confirmation-email',
    authIpRateLimiter,
    authAccountRateLimiter,
    validateDataMiddleware(resendConfirmationEmailSchema),
    usersController.resendConfirmationEmail,
);

if (env.NODE_ENV !== 'production') {
    userRoutes.get('/test-crash', (_req, _res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = undefined;
        console.log(obj.propriedadeInexistente);
    });
}
