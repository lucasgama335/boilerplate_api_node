import { authMiddleware, authorize, emailConfirmationMiddleware } from '@/app/composition-root';
import {
    confirmEmailRequestIpLimiter,
    registerRequestIpLimiter,
    resendConfirmationEmailRequestIpLimiter,
    resendConfirmationRequestEmailLimiter,
} from '@/app/http/middlewares/rate-limiter.middleware';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { validateParamsMiddleware } from '@/app/http/middlewares/validate-params-middleware';
import { idParamSchema } from '@/app/schemas/common.schemas';
import { env } from '@/env';
import { Router } from 'express';
import { confirmEmailSchema, registerUserSchema, resendConfirmationEmailSchema } from './schemas/users.schemas';
import { usersController } from './users.composition';

export const usersRoutes = Router();

usersRoutes.get('/me', authMiddleware, emailConfirmationMiddleware, usersController.showProfile);
usersRoutes.get('/:id', authMiddleware, authorize(['users:show']), validateParamsMiddleware(idParamSchema), usersController.show);
usersRoutes.post('/register', authMiddleware, authorize(['users:create']), registerRequestIpLimiter, validateDataMiddleware(registerUserSchema), usersController.registerUser);
usersRoutes.post('/confirm-email', confirmEmailRequestIpLimiter, validateDataMiddleware(confirmEmailSchema), usersController.confirmEmail);
usersRoutes.post(
    '/resend-confirmation-email',
    resendConfirmationEmailRequestIpLimiter,
    resendConfirmationRequestEmailLimiter,
    validateDataMiddleware(resendConfirmationEmailSchema),
    usersController.resendConfirmationEmail,
);

if (env.NODE_ENV !== 'production') {
    usersRoutes.get('/test-crash', (_req, _res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = undefined;
        console.log(obj.propriedadeInexistente);
    });
}
