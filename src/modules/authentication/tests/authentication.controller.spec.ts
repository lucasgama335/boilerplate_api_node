/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
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

    describe('refreshToken', () => {
        it('deve lançar AppError 401 se o cookie de refresh token não existir', async () => {
            req.cookies = {};

            await expect(authController.refreshToken(req as Request, res as Response)).rejects.toMatchObject(new AppError('Refresh token não encontrado.', 401));
        });

        it('deve rotacionar o token com sucesso e retornar um novo accessToken', async () => {
            req.cookies = { refreshToken: 'old-refresh-token' };
            req.headers = { 'user-agent': 'Mozilla' };

            const mockServiceResponse = {
                accessToken: 'new-access-token',
                newRawRefreshToken: 'new-refresh-token',
                expiresAt: new Date('2026-01-01'),
            };

            mockAuthService.refresh.mockResolvedValue(mockServiceResponse);

            await authController.refreshToken(req as Request, res as Response);

            expect(mockAuthService.refresh).toHaveBeenCalledWith('old-refresh-token', '127.0.0.1', 'Mozilla');
            expect(setRefreshTokenCookie).toHaveBeenCalledWith(res, 'new-refresh-token', mockServiceResponse.expiresAt);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ accessToken: 'new-access-token' });
        });
    });

    describe('changeAuthenthicatedUserPassword', () => {
        it('deve repassar os dados de troca de senha para o service e retornar status 200', async () => {
            req.user = { id: 'user-123' };
            req.cookies = { refreshToken: 'current-refresh-token' };
            req.body = { oldPassword: 'old', newPassword: 'new' };

            mockAuthService.changeAuthenthicatedUserPassword.mockResolvedValue({
                user: { id: 'user-123' },
                accessToken: 'new-access-token',
            });

            await authController.changeAuthenthicatedUserPassword(req as Request, res as Response);

            expect(mockAuthService.changeAuthenthicatedUserPassword).toHaveBeenCalledWith('user-123', 'new', 'current-refresh-token', 'old');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ user: { id: 'user-123' }, accessToken: 'new-access-token' });
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

    describe('revokeAllUserTokens', () => {
        it('deve limpar cookie e deslogar globalmente se keepCurrentSession for false', async () => {
            req.user = { id: 'user-123' };
            req.body = { keepCurrentSession: false };
            req.cookies = { refreshToken: 'my-token' };

            mockAuthService.revokeSessionsService.mockResolvedValue({ accessToken: null });

            await authController.revokeAllUserTokens(req as Request, res as Response);

            expect(mockAuthService.revokeSessionsService).toHaveBeenCalledWith('user-123', false, 'my-token');
            expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth' });
            expect(res.json).toHaveBeenCalledWith({ message: 'Você foi desconectado de todos os dispositivos.' });
        });
    });
});
