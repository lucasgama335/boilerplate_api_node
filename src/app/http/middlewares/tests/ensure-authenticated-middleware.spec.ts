/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAuthenticatedMiddleware } from '../ensure-authenticated-middleware';

describe('[UNIT TEST]: Middleware - Ensure Authenticated', () => {
    let mockTokenProvider: any;
    let mockSessionRevocationService: any;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: any;

    beforeEach(() => {
        mockTokenProvider = {
            verify: vi.fn(),
        };
        mockSessionRevocationService = {
            getRevokedAt: vi.fn(),
        };

        mockReq = {
            headers: {},
        };
        mockRes = {};
        nextFunction = vi.fn();
    });

    it('deve lançar AppError 401 se o cabeçalho de autorização não for enviado', async () => {
        const middleware = ensureAuthenticatedMiddleware(mockTokenProvider, mockSessionRevocationService);

        await expect(middleware(mockReq as Request, mockRes as Response, nextFunction)).rejects.toMatchObject({
            statusCode: 401,
            message: 'Token JWT não informado.',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('deve lançar AppError 401 se o token for inválido ou estiver expirado (falha no verify)', async () => {
        mockReq.headers = { authorization: 'Bearer token-invalido' };
        mockTokenProvider.verify.mockImplementation(() => {
            throw new Error('jwt expired');
        });

        const middleware = ensureAuthenticatedMiddleware(mockTokenProvider, mockSessionRevocationService);

        await expect(middleware(mockReq as Request, mockRes as Response, nextFunction)).rejects.toMatchObject({
            statusCode: 401,
            message: 'Token JWT inválido ou expirado.',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('deve lançar AppError 401 se o token for válido, mas a sessão tiver sido revogada globalmente', async () => {
        mockReq.headers = { authorization: 'Bearer token-valido' };

        // Simula um token criado em 01/01/2026 (timestamp em segundos)
        const iatDate = new Date('2026-01-01T10:00:00.000Z');
        mockTokenProvider.verify.mockReturnValue({ sub: 'user-123', iat: Math.floor(iatDate.getTime() / 1000) });

        // Simula que os tokens foram revogados DEPOIS da criação deste token (ex: 02/01/2026)
        const revokedDate = new Date('2026-01-02T10:00:00.000Z');
        mockSessionRevocationService.getRevokedAt.mockResolvedValue(revokedDate);

        const middleware = ensureAuthenticatedMiddleware(mockTokenProvider, mockSessionRevocationService);

        await expect(middleware(mockReq as Request, mockRes as Response, nextFunction)).rejects.toMatchObject({
            statusCode: 401,
            message: 'Sessão revogada. Faça login novamente.',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('deve injetar o ID do usuário na requisição e chamar next() se tudo for válido', async () => {
        mockReq.headers = { authorization: 'Bearer token-valido' };

        // Simula um token criado em 05/01/2026
        const iatDate = new Date('2026-01-05T10:00:00.000Z');
        mockTokenProvider.verify.mockReturnValue({ sub: 'user-123', iat: Math.floor(iatDate.getTime() / 1000) });

        // Simula que a última revogação ocorreu ANTES da criação do token (ex: 01/01/2026)
        const revokedDate = new Date('2026-01-01T10:00:00.000Z');
        mockSessionRevocationService.getRevokedAt.mockResolvedValue(revokedDate);

        const middleware = ensureAuthenticatedMiddleware(mockTokenProvider, mockSessionRevocationService);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockReq.user).toEqual({ id: 'user-123' });
        expect(nextFunction).toHaveBeenCalledOnce();
    });
});
