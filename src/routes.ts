import { authRoutes } from '@/modules/authentication/routes';
import { Router } from 'express';
import { userRoutes } from './modules/users/routes';
// No futuro: import { usersRoutes } from '@/modules/users/routes';

const routes = Router();

// Pluga as rotas do módulo de autenticação.
// A rota que era '/register' passa a ser '/auth/register'
routes.use('/auth', authRoutes);
routes.use('/profile', userRoutes);

export { routes };
