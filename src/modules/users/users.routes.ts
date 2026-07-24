import { authMiddleware } from '@/app/composition-root';
import { Router } from 'express';
import { profileController } from './users.composition';

export const userRoutes = Router();

userRoutes.get('/', authMiddleware, profileController.showProfile);
userRoutes.get('/test-crash', (_req, _res) => {
    // Simulando um erro clássico de Javascript (Cannot read properties of undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = undefined;
    console.log(obj.propriedadeInexistente);
});
