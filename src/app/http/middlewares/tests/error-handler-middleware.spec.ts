/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { logger } from '@/app/utils/logger';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError, ZodIssue } from 'zod';
import { errorHandler } from '../error-handler-middleware';

// Intercepta os logs e o Sentry para evitar poluição do terminal durante os testes
vi.mock('@/app/utils/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));
// Ignora o console.error que dispara em dev
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('[UNIT TEST]: Middleware - Error Handler', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: any;

    beforeEach(() => {
        mockReq = { originalUrl: '/api/test', method: 'POST', body: {}, params: {}, query: {}, user: { id: 'user-1' } as any };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
        nextFunction = vi.fn();
        vi.clearAllMocks();
    });

    it('deve processar erros operacionais do tipo AppError devolvendo o status e mensagem corretos', () => {
        const error = new AppError('Regra de negócio violada', 422);

        errorHandler(error, mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.json).toHaveBeenCalledWith({ status: 'error', message: 'Regra de negócio violada' });
    });

    it('deve processar erros de validação do ZodError formatando a matriz de erros', () => {
        const zodIssues: ZodIssue[] = [{ path: ['email'], message: 'E-mail inválido', code: 'custom' }];
        const error = new ZodError(zodIssues);

        errorHandler(error, mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Erro de validação nos campos enviados.',
            errors: [{ field: 'email', message: 'E-mail inválido' }],
        });
    });

    it('deve processar SyntaxError contendo a propriedade "body" devolvendo 400', () => {
        const error = new SyntaxError('Unexpected string in JSON') as any;
        error.body = '{"invalidJson"'; // Simulando o erro do body-parser do express

        errorHandler(error, mockReq as Request, mockRes as Response, nextFunction);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('sintaxe inválida') }));
    });

    it('deve capturar um erro conhecido do PostgreSQL (ex: 23505 Unique Constraint) e retornar como erro de negócio amigável', () => {
        const error = new Error('duplicate key') as any;
        error.code = '23505';

        errorHandler(error, mockReq as Request, mockRes as Response, nextFunction);

        expect(logger.warn).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith({ status: 'error', message: 'Esse registro já existe.' });
    });

    it('deve capturar erros desconhecidos, reportar no Sentry/Logger e devolver 500 generico', () => {
        const error = new Error('Falha catastrófica de memória');

        errorHandler(error, mockReq as Request, mockRes as Response, nextFunction);

        expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.any(Object));
        expect(logger.error).toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Ocorreu um erro interno no servidor. Nossa equipe já foi notificada.',
        });
    });

    it('deve capturar um erro de Postgres com código NÃO mapeado, reportar ao Sentry e devolver 500 genérico', () => {
        const error = new Error('constraint desconhecida') as any;
        error.code = '99999'; // formato válido de código Postgres, mas ausente de KNOWN_POSTGRES_ERROR_CODES

        errorHandler(error, mockReq as Request, mockRes as Response, nextFunction);

        expect(logger.warn).toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.any(Object));
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Erro interno no processamento de dados.',
        });
    });
});
