/* eslint-disable @typescript-eslint/no-explicit-any */
import { resetAuthRateLimits } from '@/app/http/middlewares/rate-limiter.middleware';
import { setRefreshTokenCookie } from '@/app/utils/set-refresh-token-cookie';
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticateController } from '../authentication.controller';

vi.mock('@/app/utils/set-refresh-token-cookie', () => ({
    setRefreshTokenCookie: vi.fn(),
}));

vi.mock('@/app/http/middlewares/rate-limiter.middleware', () => ({
    resetAuthRateLimits: vi.fn(),
}));

vi.mock('@/app/utils/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('Authenticate Controller (Unit Test)', () => {
    let mockAuthService: any;
    let authController: AuthenticateController;

    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        mockAuthService = {
            loginUser: vi.fn(),
            refresh: vi.fn(),
            revokeByRawToken: vi.fn(),
            createResetPassword: vi.fn(),
            resetPassword: vi.fn(),
            changeAuthenthicatedUserPassword: vi.fn(),
            revokeSessionsService: vi.fn(),
        };

        authController = new AuthenticateController(mockAuthService);
        vi.clearAllMocks();

        req = {
            body: {},
            cookies: {},
            headers: {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' } as any,
            user: undefined,
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
            cookie: vi.fn().mockReturnThis(),
            clearCookie: vi.fn().mockReturnThis(),
        };
    });

    describe('forgotPassword', () => {
        it('deve chamar o service e retornar status 200 com send()', async () => {
            req.body = { email: 'john@example.com' };
            mockAuthService.createResetPassword.mockResolvedValue(undefined);

            await authController.forgotPassword(req as Request, res as Response);

            expect(mockAuthService.createResetPassword).toHaveBeenCalledWith('john@example.com');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalled();
        });
    });

    describe('resetPassword', () => {
        it('deve chamar o service e retornar status 200 com mensagem de sucesso', async () => {
            req.body = { resetPasswordToken: 'jwt-token-string', password: 'NewPassword!123' };
            mockAuthService.resetPassword.mockResolvedValue(undefined);

            await authController.resetPassword(req as Request, res as Response);

            expect(mockAuthService.resetPassword).toHaveBeenCalledWith('jwt-token-string', 'NewPassword!123');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Operação realizada com sucesso.' });
        });
    });

    describe('loginUser', () => {
        it('deve fazer login, configurar cookie, resetar rate limit e retornar 200', async () => {
            req.body = { email: 'john@example.com', password: 'password123' };
            req.headers = { 'user-agent': 'Mozilla/5.0' };

            const mockServiceResponse = {
                user: { id: '123', email: 'john@example.com' },
                token: 'access-token',
                refreshToken: 'raw-refresh-token',
                refreshTokenExpiresAt: new Date('2026-01-01'),
            };

            mockAuthService.loginUser.mockResolvedValue(mockServiceResponse);

            await authController.loginUser(req as Request, res as Response);

            expect(mockAuthService.loginUser).toHaveBeenCalledWith({ email: 'john@example.com', password: 'password123' }, '127.0.0.1', 'Mozilla/5.0');
            expect(setRefreshTokenCookie).toHaveBeenCalledWith(res, 'raw-refresh-token', mockServiceResponse.refreshTokenExpiresAt);
            expect(resetAuthRateLimits).toHaveBeenCalledWith('127.0.0.1', 'john@example.com');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ user: mockServiceResponse.user, token: 'access-token' });
        });
    });

    describe('logout', () => {
        it('deve limpar o cookie e retornar 204 com sucesso', async () => {
            req.cookies = { refreshToken: 'my-token' };

            await authController.logout(req as Request, res as Response);

            expect(mockAuthService.revokeByRawToken).toHaveBeenCalledWith('my-token');
            expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth' });
            expect(res.status).toHaveBeenCalledWith(204);
        });
    });
});
