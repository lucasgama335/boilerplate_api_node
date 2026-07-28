/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { logger } from '@/app/utils/logger';
import { env } from '@/env';
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationController } from '../authentication.controller';
import { AuthenticationService } from '../authentication.service';

// Mockamos o logger para podermos espionar se os erros silenciosos estão sendo registrados
vi.mock('@/app/utils/logger', () => ({
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

describe('[UNIT TEST]: Módulo de Autenticação - Controller', () => {
    let authenticationController: AuthenticationController;
    let mockAuthService: any;

    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockAuthService = {
            loginUser: vi.fn(),
            refresh: vi.fn(),
            revokeByRawToken: vi.fn(),
            createResetPassword: vi.fn(),
            resetPassword: vi.fn(),
            changeAuthenticatedUserPassword: vi.fn(),
            revokeSessionsService: vi.fn(),
        };

        authenticationController = new AuthenticationController(mockAuthService as AuthenticationService);

        mockReq = {
            body: {},
            cookies: {},
            headers: {},
            ip: '192.168.0.1',
            socket: { remoteAddress: '192.168.0.1' } as any,
            user: { id: 'user-123' } as any,
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            send: vi.fn(),
            cookie: vi.fn(),
            clearCookie: vi.fn(),
        };
    });

    describe('[method]: #loginUser', () => {
        it('deve extrair e-mail e senha do body, ip e user-agent da request e repassar ao service', async () => {
            mockReq.body = { email: 'john@example.com', password: '123' };
            mockReq.headers = { 'user-agent': 'Mozilla/5.0' };

            const fakeExpiresAt = new Date();
            mockAuthService.loginUser.mockResolvedValue({
                user: { id: 'user-123', email: 'john@example.com' },
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                refreshTokenExpiresAt: fakeExpiresAt,
            });

            await authenticationController.loginUser(mockReq as Request, mockRes as Response);

            expect(mockAuthService.loginUser).toHaveBeenCalledWith({ email: 'john@example.com', password: '123' }, '192.168.0.1', 'Mozilla/5.0');
            expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-token', expect.objectContaining({ expires: fakeExpiresAt }));
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                user: { id: 'user-123', email: 'john@example.com' },
                accessToken: 'access-token',
            });
        });

        it('deve usar fallbacks (0.0.0.0 e unknown) quando ip e user-agent não estiverem disponíveis na request', async () => {
            // 💡 Recriamos o mockReq omitindo propositalmente o "ip" e o "user-agent"
            mockReq = {
                body: { email: 'john@example.com', password: '123' },
                headers: {}, // Sem user-agent
                socket: {} as any, // Sem remoteAddress
            };

            mockAuthService.loginUser.mockResolvedValue({
                user: {},
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                refreshTokenExpiresAt: new Date(),
            });

            await authenticationController.loginUser(mockReq as Request, mockRes as Response);

            // O Controller deve injetar os fallbacks antes de chamar o Service
            expect(mockAuthService.loginUser).toHaveBeenCalledWith(expect.anything(), '0.0.0.0', 'unknown');
        });
    });

    describe('[method]: #refreshToken', () => {
        it('deve lançar AppError 401 se o cookie de refreshToken não for enviado', async () => {
            mockReq.cookies = {}; // Vazio

            await expect(authenticationController.refreshToken(mockReq as Request, mockRes as Response)).rejects.toMatchObject({
                statusCode: 401,
                message: 'Refresh token não encontrado.',
            });
        });

        it('deve renovar o token e injetar o novo cookie de refresh token na resposta quando a rotação ocorrer', async () => {
            mockReq.cookies = { refreshToken: 'old-refresh-token' };
            mockReq.headers = { 'user-agent': 'Postman' };

            const fakeExpiresAt = new Date();
            mockAuthService.refresh.mockResolvedValue({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
                expiresAt: fakeExpiresAt,
            });

            await authenticationController.refreshToken(mockReq as Request, mockRes as Response);

            expect(mockAuthService.refresh).toHaveBeenCalledWith('old-refresh-token', '192.168.0.1', 'Postman');
            expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', 'new-refresh-token', expect.objectContaining({ expires: fakeExpiresAt }));
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ accessToken: 'new-access-token' });
        });

        it('não deve mexer no cookie existente caso esteja dentro do grace period (refreshToken e expiresAt null)', async () => {
            mockReq.cookies = { refreshToken: 'current-refresh-token' };

            mockAuthService.refresh.mockResolvedValue({
                accessToken: 'new-access-token',
                refreshToken: null, // Indicativo de Grace Period
                expiresAt: null,
            });

            await authenticationController.refreshToken(mockReq as Request, mockRes as Response);

            // Confirma que não tentou sobrescrever o cookie do cliente
            expect(mockRes.cookie).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ accessToken: 'new-access-token' });
        });
    });

    describe('[method]: #logout', () => {
        it('deve revogar o token, limpar o cookie e retornar 204 com sucesso', async () => {
            mockReq.cookies = { refreshToken: 'token-to-revoke' };

            await authenticationController.logout(mockReq as Request, mockRes as Response);

            expect(mockAuthService.revokeByRawToken).toHaveBeenCalledWith('token-to-revoke');
            expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', { path: env.AUTH_ROUTE_PREFIX });
            expect(mockRes.status).toHaveBeenCalledWith(204);
            expect(mockRes.send).toHaveBeenCalled();
        });

        it('deve silenciar o erro caso a revogação falhe, registrar no logger e continuar o logout forçado', async () => {
            mockReq.cookies = { refreshToken: 'invalid-token' };

            mockAuthService.revokeByRawToken.mockRejectedValue(new AppError('Token inválido'));
            const spyLogger = vi.spyOn(logger, 'warn');

            await authenticationController.logout(mockReq as Request, mockRes as Response);

            expect(spyLogger).toHaveBeenCalledWith(expect.any(Object), 'Falha ao revogar refresh token durante logout');
            expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', { path: env.AUTH_ROUTE_PREFIX });
            expect(mockRes.status).toHaveBeenCalledWith(204);
            expect(mockRes.send).toHaveBeenCalled();
        });
    });

    describe('[method]: #forgotPassword', () => {
        it('deve repassar o email para o service e retornar status 200', async () => {
            mockReq.body = { email: 'john@example.com' };

            await authenticationController.forgotPassword(mockReq as Request, mockRes as Response);

            expect(mockAuthService.createResetPassword).toHaveBeenCalledWith('john@example.com');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalled();
        });
    });

    describe('[method]: #resetPassword', () => {
        it('deve repassar o token de reset e a nova senha e retornar status 200', async () => {
            mockReq.body = { resetPasswordToken: 'reset-token-123', password: 'NewPassword@123' };

            await authenticationController.resetPassword(mockReq as Request, mockRes as Response);

            expect(mockAuthService.resetPassword).toHaveBeenCalledWith('reset-token-123', 'NewPassword@123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'Operação realizada com sucesso.' });
        });
    });

    describe('[method]: #changeAuthenticatedUserPassword', () => {
        it('deve extrair userId e refreshToken e passar as senhas para alteração', async () => {
            mockReq.user = { id: 'user-777' };
            mockReq.cookies = { refreshToken: 'current-session-token' };
            mockReq.body = { oldPassword: 'OldPass@123', newPassword: 'NewPass@123' };

            const fakeResponse = { user: { id: 'user-777' }, accessToken: 'new-access' };
            mockAuthService.changeAuthenticatedUserPassword.mockResolvedValue(fakeResponse);

            await authenticationController.changeAuthenticatedUserPassword(mockReq as Request, mockRes as Response);

            expect(mockAuthService.changeAuthenticatedUserPassword).toHaveBeenCalledWith('user-777', 'NewPass@123', 'current-session-token', 'OldPass@123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(fakeResponse);
        });
    });

    describe('[method]: #revokeAllUserTokens', () => {
        it('deve limpar os cookies e informar logout global se accessToken retornar nulo', async () => {
            mockReq.user = { id: 'user-888' };
            mockReq.body = { keepCurrentSession: false };

            mockAuthService.revokeSessionsService.mockResolvedValue({ accessToken: null });

            await authenticationController.revokeAllUserTokens(mockReq as Request, mockRes as Response);

            expect(mockAuthService.revokeSessionsService).toHaveBeenCalledWith('user-888', false, undefined);
            expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', { path: env.AUTH_ROUTE_PREFIX });
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'Você foi desconectado de todos os dispositivos.' });
        });

        it('deve preservar os cookies e devolver novo acesso se keepCurrentSession for verdadeiro', async () => {
            mockReq.user = { id: 'user-888' };
            mockReq.body = { keepCurrentSession: true };
            mockReq.cookies = { refreshToken: 'my-current-token' };

            mockAuthService.revokeSessionsService.mockResolvedValue({ accessToken: 'new-access-token' });

            await authenticationController.revokeAllUserTokens(mockReq as Request, mockRes as Response);

            expect(mockAuthService.revokeSessionsService).toHaveBeenCalledWith('user-888', true, 'my-current-token');
            expect(mockRes.clearCookie).not.toHaveBeenCalled(); // Não deslogou do dispositivo atual
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Todos os outros dispositivos foram desconectados. Sua sessão atual foi mantida.',
                accessToken: 'new-access-token',
            });
        });
    });
});
