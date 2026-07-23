import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { databaseInstance } from '@/database';
import { Router } from 'express';
import { GetUserProfileService } from './application/GetUserProfileService';
import { ProfileController } from './http/controllers/ProfileController';
import { DrizzleUserRepository } from './infra/DrizzleUserRepository';

export const userRoutes = Router();

// ==========================================
// 🛠️ FÁBRICA DE DEPENDÊNCIAS (COMPOSITION ROOT)
// ==========================================
const userRepository = new DrizzleUserRepository(databaseInstance);
const getUserProfileService = new GetUserProfileService(userRepository);

const profileController = new ProfileController(getUserProfileService);

// ==========================================
// 🚀 ROTAS DO MÓDULO
// ==========================================
userRoutes.get('/', ensureAuthenticatedMiddleware, profileController.showProfile);
