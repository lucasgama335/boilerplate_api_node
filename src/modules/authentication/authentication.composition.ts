import { hashProvider, tokenProvider } from '@/app/composition-root';
import { databaseInstance } from '@/database/index';
import { userRepository } from '@/modules/users/users.composition'; // reaproveita, não recria

import { AuthenticateUserService } from './application/AuthenticateUserService';
import { RefreshTokensService } from './application/RefreshTokensService';
import { AuthenticateController } from './http/controllers/AuthenticateController';
import { DrizzleRefreshTokenRepository } from './infra/DrizzleRefreshTokenRepository';

const refreshTokenRepository = new DrizzleRefreshTokenRepository(databaseInstance);

const authenticateService = new AuthenticateUserService(userRepository, refreshTokenRepository, hashProvider, tokenProvider);
const refreshTokensService = new RefreshTokensService(refreshTokenRepository, tokenProvider);

export const authenticateController = new AuthenticateController(authenticateService, refreshTokensService);
