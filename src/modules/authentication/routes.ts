import { Router } from 'express';

// 1. Importamos as nossas implementações reais (A Infraestrutura)
import { Argon2HashProvider } from '@/app/infra/hashing/Argon2HashProvider';
import { DrizzleUserRepository } from '@/modules/users/infra/DrizzleUserRepository';

// 2. Importamos a Regra de Negócio e o Controller (A Aplicação e o HTTP)
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { JwtTokenProvider } from '@/app/infra/token/JwtTokenProvider';
import { databaseInstance } from '@/database/index';
import { AuthenticateUserService } from './application/AuthenticateUserService';
import { RefreshTokensService } from './application/RefreshTokensService';
import { AuthenticateController } from './http/controllers/AuthenticateController';
import { authenticateUserSchema } from './http/schemas/authenticate-user.schema';
import { refreshTokenSchema } from './http/schemas/refresh-token-schema';
import { registerUserSchema } from './http/schemas/register-user-schema';
import { DrizzleRefreshTokenRepository } from './infra/DrizzleRefreshTokenRepository';

export const authRoutes = Router();

// ==========================================
// 🛠️ FÁBRICA DE DEPENDÊNCIAS (COMPOSITION ROOT)
// ==========================================
const userRepository = new DrizzleUserRepository(databaseInstance);
const refreshTokenRepository = new DrizzleRefreshTokenRepository(databaseInstance);
const hashProvider = new Argon2HashProvider();
const tokenProvider = new JwtTokenProvider();

const authenticateService = new AuthenticateUserService(userRepository, refreshTokenRepository, hashProvider, tokenProvider);
const refreshTokensService = new RefreshTokensService(refreshTokenRepository, tokenProvider);

const authenticateController = new AuthenticateController(authenticateService, refreshTokensService);

// ==========================================
// 🚀 ROTAS DO MÓDULO
// ==========================================
authRoutes.post('/register', validateDataMiddleware(registerUserSchema), authenticateController.registerUser);
authRoutes.post('/login', validateDataMiddleware(authenticateUserSchema), authenticateController.loginUser);
authRoutes.post('/refresh', validateDataMiddleware(refreshTokenSchema), authenticateController.refreshToken);
