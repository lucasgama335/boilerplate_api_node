import { authMiddleware } from '@/app/composition-root';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { env } from '@/env';
import { Router } from 'express';
import { usersController } from './users.composition';
import { registerUserSchema } from './users.schema';

export const userRoutes = Router();

userRoutes.get('/me', authMiddleware, usersController.showProfile);
userRoutes.post('/register', validateDataMiddleware(registerUserSchema), usersController.registerUser);

if (env.NODE_ENV !== 'production') {
    userRoutes.get('/test-crash', (_req, _res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = undefined;
        console.log(obj.propriedadeInexistente);
    });
}
