/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAuthenticatedMiddleware } from '../ensure-authenticated-middleware';

describe('Ensure Authenticated Middleware', () => {
    let mockTokenProvider: any;
    let mockRevocationProvider: any;

    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    let middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;

    beforeEach(() => {
        // Resetando os mocks antes de cada teste
        mockTokenProvider = {
            verify: vi.fn(),
        };

        mockRevocationProvider = {
            getRevokedAt: vi.fn(),
        };

        // Simulando a requisição do Express
        req = {
            headers: {},
        };
        res = {};
        next = vi.fn(); // vi.fn() permite sabermos se o next() foi chamado depois

        // Instanciando a fábrica do middleware
        middleware = ensureAuthenticatedMiddleware(mockTokenProvider, mockRevocationProvider);
    });

    it('deve lançar erro se o header authorization não for informado', async () => {
        // req.headers vazio por padrão no beforeEach

        // Esperamos que a chamada do middleware lance o erro AppError específico
        await expect(middleware(req as Request, res as Response, next)).rejects.toMatchObject(new AppError('Token JWT não informado.', 401));

        expect(next).not.toHaveBeenCalled();
    });

    it('deve lançar erro se o token for inválido ou estiver expirado', async () => {
        req.headers = { authorization: 'Bearer token-invalido' };

        // Forçamos o verify a quebrar (simulando falha de assinatura ou tempo)
        mockTokenProvider.verify.mockImplementation(() => {
            throw new Error('jwt expired');
        });

        await expect(middleware(req as Request, res as Response, next)).rejects.toMatchObject(new AppError('Token JWT inválido ou expirado.', 401));

        expect(next).not.toHaveBeenCalled();
    });

    it('deve lançar erro se o token for mais antigo que a data de revogação da sessão', async () => {
        req.headers = { authorization: 'Bearer token-valido' };

        // Simulamos o token criado em "1000" segundos (Timestamp Unix)
        mockTokenProvider.verify.mockReturnValue({
            sub: 'user-123',
            iat: 1000,
            exp: 5000,
        });

        // Simulamos que as sessões foram revogadas no segundo "2000" (depois da criação do token)
        // Multiplicamos por 1000 porque o Date do JS usa milissegundos
        const revokedDate = new Date(2000 * 1000);
        mockRevocationProvider.getRevokedAt.mockResolvedValue(revokedDate);

        await expect(middleware(req as Request, res as Response, next)).rejects.toMatchObject(new AppError('Sessão revogada. Faça login novamente.', 401));

        expect(next).not.toHaveBeenCalled();
    });

    it('deve injetar o usuário na requisição e chamar next() em caso de sucesso', async () => {
        req.headers = { authorization: 'Bearer token-valido' };

        mockTokenProvider.verify.mockReturnValue({
            sub: 'user-123',
            iat: 3000, // Token criado AGORA (segundo 3000)
            exp: 5000,
        });

        // Sessões foram revogadas no passado (segundo 2000), então o token atual é válido!
        const revokedDate = new Date(2000 * 1000);
        mockRevocationProvider.getRevokedAt.mockResolvedValue(revokedDate);

        // Executa o middleware
        await middleware(req as Request, res as Response, next);

        // Valida as consequências
        expect(req.user).toEqual({ id: 'user-123' });
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('deve permitir acesso se não houver data de revogação registrada', async () => {
        req.headers = { authorization: 'Bearer token-valido' };

        mockTokenProvider.verify.mockReturnValue({
            sub: 'user-123',
            iat: 1000,
            exp: 5000,
        });

        // Usuário nunca revogou as sessões (retorna null)
        mockRevocationProvider.getRevokedAt.mockResolvedValue(null);

        await middleware(req as Request, res as Response, next);

        expect(req.user).toEqual({ id: 'user-123' });
        expect(next).toHaveBeenCalledTimes(1);
    });
});
