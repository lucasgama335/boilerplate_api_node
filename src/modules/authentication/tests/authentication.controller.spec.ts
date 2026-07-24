/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { resetAuthRateLimits } from '@/app/http/middlewares/rate-limiter.middleware';
import { setRefreshTokenCookie } from '@/app/utils/set-refresh-token-cookie';
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticateController } from '../authentication.controller';

// 1. "Sequestramos" os utilitários externos para que não executem código real durante o teste
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

    // Utilitários para gerar req e res falsos limpos para cada teste
    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        // Resetamos o mock do serviço
        mockAuthService = {
            registerUser: vi.fn(),
            loginUser: vi.fn(),
            refresh: vi.fn(),
            revokeByRawToken: vi.fn(),
            revokeSessionsService: vi.fn(),
        };

        // Injetamos o serviço falso no controller
        authController = new AuthenticateController(mockAuthService);

        // Limpamos os mocks das funções importadas soltas
        vi.clearAllMocks();

        // Simulamos a requisição do Express
        req = {
            body: {},
            cookies: {},
            headers: {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' } as any,
            user: undefined,
        };

        // Simulamos a resposta do Express encadeável (ex: res.status(200).json(...))
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
            cookie: vi.fn().mockReturnThis(),
            clearCookie: vi.fn().mockReturnThis(),
        };
    });

    describe('registerUser', () => {
        it('deve repassar os dados para o service e retornar status 201', async () => {
            const userData = { firstName: 'Jane', email: 'jane@example.com' };
            req.body = userData;

            // Simulamos a resposta do service
            mockAuthService.registerUser.mockResolvedValue({ id: '123', ...userData });

            await authController.registerUser(req as Request, res as Response);

            expect(mockAuthService.registerUser).toHaveBeenCalledWith(userData);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: '123', ...userData });
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

            // Verifica se o utilitário de cookie foi chamado com a resposta e os tokens certos
            expect(setRefreshTokenCookie).toHaveBeenCalledWith(res, 'raw-refresh-token', mockServiceResponse.refreshTokenExpiresAt);

            // Verifica se o rate limit foi limpo após o sucesso
            expect(resetAuthRateLimits).toHaveBeenCalledWith('127.0.0.1', 'john@example.com');

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ user: mockServiceResponse.user, token: 'access-token' });
        });
    });

    describe('refreshToken', () => {
        it('deve lançar AppError 401 se o cookie de refresh token não existir', async () => {
            req.cookies = {}; // Vazio

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

    describe('logout', () => {
        it('deve limpar o cookie e retornar 204 com sucesso', async () => {
            req.cookies = { refreshToken: 'my-token' };

            await authController.logout(req as Request, res as Response);

            expect(mockAuthService.revokeByRawToken).toHaveBeenCalledWith('my-token');
            expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth' });
            expect(res.status).toHaveBeenCalledWith(204);
            expect(res.send).toHaveBeenCalled();
        });

        it('deve ignorar erros do service (ex: token já revogado), limpar cookie de qualquer forma e retornar 204', async () => {
            req.cookies = { refreshToken: 'my-token' };

            // Simulamos que o serviço falha silenciosamente por baixo dos panos
            mockAuthService.revokeByRawToken.mockRejectedValue(new Error('Token já revogado'));

            await authController.logout(req as Request, res as Response);

            // Garante que não quebrou a requisição, o cookie ainda foi limpo
            expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth' });
            expect(res.status).toHaveBeenCalledWith(204);
        });
    });

    describe('revokeAllUserTokens', () => {
        it('deve limpar cookie e deslogar globalmente se keepCurrentSession for false', async () => {
            req.user = { id: 'user-123' };
            req.body = { keepCurrentSession: false };
            req.cookies = { refreshToken: 'my-token' };

            // Se é logout global absoluto, o serviço retorna null no accessToken
            mockAuthService.revokeSessionsService.mockResolvedValue({ accessToken: null });

            await authController.revokeAllUserTokens(req as Request, res as Response);

            expect(mockAuthService.revokeSessionsService).toHaveBeenCalledWith('user-123', false, 'my-token');
            expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/api/auth' });
            expect(res.json).toHaveBeenCalledWith({ message: 'Você foi desconectado de todos os dispositivos.' });
        });

        it('deve preservar o cookie, não chamar clearCookie e retornar novo token se keepCurrentSession for true', async () => {
            req.user = { id: 'user-123' };
            req.body = { keepCurrentSession: true };
            req.cookies = { refreshToken: 'my-token' };

            mockAuthService.revokeSessionsService.mockResolvedValue({ accessToken: 'novo-access-token-preservado' });

            await authController.revokeAllUserTokens(req as Request, res as Response);

            expect(mockAuthService.revokeSessionsService).toHaveBeenCalledWith('user-123', true, 'my-token');
            expect(res.clearCookie).not.toHaveBeenCalled(); // 👈 Não deve limpar o cookie atual!
            expect(res.json).toHaveBeenCalledWith({
                message: 'Todos os outros dispositivos foram desconectados. Sua sessão atual foi mantida.',
                accessToken: 'novo-access-token-preservado',
            });
        });
    });
});
