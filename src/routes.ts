import { authRoutes } from '@/modules/authentication/authentication.routes';
import { Router } from 'express';
import { userRoutes } from './modules/users/users.routes';

export const routes = Router();

// Pluga as rotas do módulo de autenticação.
routes.use('/auth', authRoutes);
routes.use('/me', userRoutes);
