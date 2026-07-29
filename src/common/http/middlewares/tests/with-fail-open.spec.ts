/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/common/exceptions/AppError';
import { logger } from '@/common/utils/logger';
import * as Sentry from '@sentry/node';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withFailOpen } from '../with-fail-open';

// Intercepta logger e Sentry, igual ao padrão já usado em error-handler-middleware.spec.ts
vi.mock('@/common/utils/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

describe('[UNIT TEST]: Middleware - With Fail Open', () => {
    const mockReq = {} as Request;
    const mockRes = {} as Response;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Cada teste usa um limiterName ÚNICO, porque o throttle de Sentry
    // (`lastReportedAtByLimiter`) é um Map em escopo de módulo, compartilhado
    // entre todos os testes do arquivo — isolar por nome evita um teste
    // "vazar" estado de throttle para o próximo.
    function buildPrimary(errToPass?: unknown): RequestHandler {
        return vi.fn((_req: Request, _res: Response, next: NextFunction) => {
            next(errToPass as any);
        });
    }

    it('deve chamar next() sem erro quando o primary passa direto (sem erro nenhum)', () => {
        const primary = buildPrimary(undefined);
        const fallback: RequestHandler = vi.fn();
        const next = vi.fn();

        const middleware = withFailOpen(primary, fallback, 'success-case');
        middleware(mockReq, mockRes, next);

        expect(next).toHaveBeenCalledWith();
        expect(fallback).not.toHaveBeenCalled();
    });

    it('deve repassar um AppError (limite realmente excedido) para o next(), sem acionar o fallback', () => {
        const rateLimitError = new AppError('Muitas tentativas excedidas a partir deste IP. Tente novamente mais tarde.', 429);
        const primary = buildPrimary(rateLimitError);
        const fallback: RequestHandler = vi.fn();
        const next = vi.fn();

        const middleware = withFailOpen(primary, fallback, 'apperror-case');
        middleware(mockReq, mockRes, next);

        expect(next).toHaveBeenCalledWith(rateLimitError);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('deve acionar o fallback e logar um aviso quando o primary falha por erro de infraestrutura (não-AppError)', () => {
        const infraError = new Error('ECONNREFUSED: Redis indisponível');
        const primary = buildPrimary(infraError);
        const fallback: RequestHandler = vi.fn();
        const next = vi.fn();

        const middleware = withFailOpen(primary, fallback, 'infra-error-case');
        middleware(mockReq, mockRes, next);

        expect(fallback).toHaveBeenCalledWith(mockReq, mockRes, next);
        expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ err: infraError, limiter: 'infra-error-case' }), expect.stringContaining('fail-open'));
    });

    it('deve repassar exatamente req, res e next para o fallback (não perder o contexto da requisição)', () => {
        const infraError = new Error('Redis fora do ar');
        const primary = buildPrimary(infraError);
        const fallback: RequestHandler = vi.fn();
        const next = vi.fn();
        const customReq = { originalUrl: '/api/auth/login' } as Request;
        const customRes = { status: vi.fn() } as unknown as Response;

        const middleware = withFailOpen(primary, fallback, 'context-passthrough-case');
        middleware(customReq, customRes, next);

        expect(fallback).toHaveBeenCalledWith(customReq, customRes, next);
    });

    it('deve reportar ao Sentry na primeira falha de infraestrutura observada para aquele limiter', () => {
        const infraError = new Error('Timeout de conexão');
        const primary = buildPrimary(infraError);
        const fallback: RequestHandler = vi.fn();
        const next = vi.fn();

        const middleware = withFailOpen(primary, fallback, 'sentry-first-time-case');
        middleware(mockReq, mockRes, next);

        expect(Sentry.captureException).toHaveBeenCalledWith(infraError, { tags: { component: 'rate-limiter', limiter: 'sentry-first-time-case' } });
    });

    it('🔒 NÃO deve reportar ao Sentry de novo para o mesmo limiter dentro da janela de throttle (evita flood de eventos)', () => {
        const infraError = new Error('Redis instável');
        const primary = buildPrimary(infraError);
        const fallback: RequestHandler = vi.fn();
        const next = vi.fn();

        const middleware = withFailOpen(primary, fallback, 'sentry-throttle-case');

        // Duas falhas consecutivas do MESMO limiter, dentro da janela de 60s
        middleware(mockReq, mockRes, next);
        middleware(mockReq, mockRes, next);

        // Sentry só deveria ter sido acionado UMA vez para esse limiter específico
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        // Mas o fallback (proteção real do usuário) continua funcionando nas duas vezes
        expect(fallback).toHaveBeenCalledTimes(2);
    });

    it('deve tratar cada limiterName de forma independente para fins de throttle do Sentry', () => {
        const infraError = new Error('Falha de infra');
        const fallback: RequestHandler = vi.fn();
        const next = vi.fn();

        const middlewareA = withFailOpen(buildPrimary(infraError), fallback, 'limiter-a-case');
        const middlewareB = withFailOpen(buildPrimary(infraError), fallback, 'limiter-b-case');

        middlewareA(mockReq, mockRes, next);
        middlewareB(mockReq, mockRes, next);

        // Limiters diferentes não compartilham o throttle — os dois devem reportar
        expect(Sentry.captureException).toHaveBeenCalledWith(infraError, { tags: { component: 'rate-limiter', limiter: 'limiter-a-case' } });
        expect(Sentry.captureException).toHaveBeenCalledWith(infraError, { tags: { component: 'rate-limiter', limiter: 'limiter-b-case' } });
    });
});
