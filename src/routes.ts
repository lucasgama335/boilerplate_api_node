import { authRoutes } from '@/modules/authentication/authentication.routes';
import { Router } from 'express';
import { departmentsRoutes } from './modules/departments/departments.routes';
import { permissionsRoutes } from './modules/permissions/permissions.routes';
import { userAccessRoutes } from './modules/user-access/user-access.routes';
import { usersRoutes } from './modules/users/users.routes';

export const routes = Router();

// Pluga as rotas dos módulos
routes.use('/auth', authRoutes);
routes.use('/users', usersRoutes);
routes.use('/departments', departmentsRoutes);
routes.use('/permissions', permissionsRoutes);
routes.use('/userAccess', userAccessRoutes);
