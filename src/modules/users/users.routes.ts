import { authMiddleware } from '@/app/composition-root';
import { env } from '@/env';
import { Router } from 'express';
import { profileController } from './users.composition';

export const userRoutes = Router();

userRoutes.get('/', authMiddleware, profileController.showProfile);
if (env.NODE_ENV !== 'production') {
    userRoutes.get('/test-crash', (_req, _res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = undefined;
        console.log(obj.propriedadeInexistente);
    });
}
