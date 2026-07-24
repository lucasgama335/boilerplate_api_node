import { AppError } from '@/app/exceptions/AppError';
import { logger } from '@/app/utils/logger';
import { sanitizeBody } from '@/app/utils/sanitize-body';
import * as Sentry from '@sentry/node';
import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, ZodIssue } from 'zod';
import { errorHandler } from '../error-handler-middleware';

// 1. Mocks de Infraestrutura (Evita enviar logs ou dados para Sentry reais no teste)
vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

vi.mock('@/app/utils/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}));

vi.mock('@/app/utils/sanitize-body', () => ({
    sanitizeBody: vi.fn().mockImplementation((body) => ({ ...body, SANITIZED: true })),
}));

// Mock da variável de ambiente para não poluir o console com "🚨 [Unhandled Error]" do dev mode
vi.mock('@/env', () => ({
    env: { NODE_ENV: 'test' },
}));

describe('Error Handler Middleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();

        req = {
            body: { password: 'secret-password' },
            params: { id: '123' },
            query: { search: 'test' },
            method: 'POST',
            originalUrl: '/api/auth/register',
            user: { id: 'user-123' },
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
    });

    it('deve formatar corretamente um AppError (erro operacional esperado) sem acionar alertas', () => {
        const error = new AppError('Acesso não autorizado', 403);

        errorHandler(error, req as Request, res as Response, next);

        // Deve retornar o status correto e a mensagem limpa
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Acesso não autorizado',
        });

        // Não deve disparar alertas no Sentry ou Logger (é um erro mapeado)
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('deve formatar corretamente um ZodError (erro de validação) com array de campos', () => {
        // Simulando um erro do Zod (ex: falha no schema)
        const mockZodIssues: ZodIssue[] = [
            { path: ['email'], message: 'E-mail inválido', code: 'custom' },
            { path: ['passwordConfirmation'], message: 'As senhas não coincidem', code: 'custom' },
        ];
        const error = new ZodError(mockZodIssues);

        errorHandler(error, req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Erro de validação nos campos enviados.',
            errors: [
                { field: 'email', message: 'E-mail inválido' },
                { field: 'passwordConfirmation', message: 'As senhas não coincidem' },
            ],
        });

        // Não deve disparar alertas (é falha do usuário, não do servidor)
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('deve sanitizar o body e reportar erros inesperados (Bugs/Database) para o Sentry e Logger', () => {
        const error = new Error('Falha catastrófica de conexão com o banco');
        error.stack = 'Error Stacktrace Demo';

        errorHandler(error, req as Request, res as Response, next);

        // 1. Verifica se chamou a sanitização para não vazar a senha do body
        expect(sanitizeBody).toHaveBeenCalledWith(req.body);

        // 2. Verifica se enviou pro Sentry com o contexto correto
        expect(Sentry.captureException).toHaveBeenCalledWith(error, {
            extra: {
                body: { password: 'secret-password', SANITIZED: true },
                params: req.params,
                query: req.query,
            },
            user: { id: 'user-123' },
            tags: { route: '/api/auth/register', method: 'POST' },
        });

        // 3. Verifica se salvou no log local
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                err: error,
                method: 'POST',
                path: '/api/auth/register',
                userId: 'user-123',
            }),
            'Unhandled Server Error',
        );

        // 4. Verifica a resposta segura para o cliente (escondendo os detalhes técnicos)
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Ocorreu um erro interno no servidor. Nossa equipe já foi notificada.',
        });
    });

    it('deve lidar corretamente com erros inesperados quando o usuário não estiver autenticado', () => {
        const error = new Error('Erro sem usuário');
        req.user = undefined; // Rota pública sem autenticação

        errorHandler(error, req as Request, res as Response, next);

        // O Sentry não deve tentar ler o `id` de um user que não existe
        expect(Sentry.captureException).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                user: undefined,
            }),
        );
    });
});
