import { Router } from 'express';

// 1. Importamos as nossas implementações reais (A Infraestrutura)
import { Argon2HashProvider } from '@/app/infra/hashing/Argon2HashProvider';
import { DrizzleUserRepository } from '@/modules/users/infra/DrizzleUserRepository';

// 2. Importamos a Regra de Negócio e o Controller (A Aplicação e o HTTP)
import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { JwtTokenProvider } from '@/app/infra/token/JwtTokenProvider';
import { databaseInstance } from '@/database/index';
import { AuthenticateUserService } from './application/AuthenticateUserService';
import { AuthenticateController } from './http/controllers/AuthenticateController';
import { authenticateUserSchema } from './http/schemas/authenticate-user.schema';
import { registerUserSchema } from './http/schemas/register-user-schema';

export const authRoutes = Router();

// ==========================================
// 🛠️ FÁBRICA DE DEPENDÊNCIAS (COMPOSITION ROOT)
// ==========================================
const userRepository = new DrizzleUserRepository(databaseInstance);
const hashProvider = new Argon2HashProvider();
const tokenProvider = new JwtTokenProvider();

const authenticateService = new AuthenticateUserService(
    userRepository,
    hashProvider,
    tokenProvider,
);

const authenticateController = new AuthenticateController(authenticateService);

// ==========================================
// 🚀 ROTAS DO MÓDULO
// ==========================================
authRoutes.post(
    '/register',
    validateDataMiddleware(registerUserSchema),
    authenticateController.registerUser,
);
authRoutes.post(
    '/login',
    validateDataMiddleware(authenticateUserSchema),
    authenticateController.loginUser,
);
authRoutes.post('/me', ensureAuthenticatedMiddleware, authenticateController.showAuthenticatedUser);
