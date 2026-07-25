import { LoginAttemptsRepository } from '@/modules/authentication/login-attempts.repository';
import { DrizzleRefreshTokenRepository } from '@/modules/authentication/refresh-tokens.repository';
import { DrizzleUserRepository } from '@/modules/users/users.repository';
import { databaseInstance } from './index';

// Instanciamos todos os repositórios em um lugar neutro e sem dependências externas
export const userRepository = new DrizzleUserRepository(databaseInstance);
export const refreshTokenRepository = new DrizzleRefreshTokenRepository(databaseInstance);
export const loginAttemptRepository = new LoginAttemptsRepository(databaseInstance);
