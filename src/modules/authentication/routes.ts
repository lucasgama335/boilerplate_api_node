import { Router } from 'express';

// 1. Importamos as nossas implementações reais (A Infraestrutura)

// 2. Importamos a Regra de Negócio e o Controller (A Aplicação e o HTTP)
import { authAccountRateLimiter, authIpRateLimiter } from '@/app/http/middlewares/rate-limiter.middleware';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { authenticateController } from './authentication.composition';
import { authenticateUserSchema } from './http/schemas/authenticate-user.schema';
import { registerUserSchema } from './http/schemas/register-user-schema';

export const authRoutes = Router();

authRoutes.post('/register', validateDataMiddleware(registerUserSchema), authenticateController.registerUser);
authRoutes.post('/login', authIpRateLimiter, authAccountRateLimiter, validateDataMiddleware(authenticateUserSchema), authenticateController.loginUser);
authRoutes.post('/refresh', authIpRateLimiter, authenticateController.refreshToken);
authRoutes.post('/logout', authenticateController.logout);
