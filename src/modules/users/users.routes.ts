import { authMiddleware } from '@/app/composition-root';
import { Router } from 'express';
import { profileController } from './users.composition';

export const userRoutes = Router();

userRoutes.get('/', authMiddleware, profileController.showProfile);
