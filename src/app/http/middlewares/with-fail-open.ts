// src/app/http/middlewares/with-fail-open.ts
import { AppError } from '@/app/exceptions/AppError';
import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Envolve um rate limiter para que, se o STORE (Redis) falhar por motivo de
 * infraestrutura, a requisição passe direto (fail-open) em vez de travar
 * o endpoint inteiro. Um 429 legítimo (limite realmente excedido) continua
 * sendo bloqueado normalmente, porque é um AppError intencional.
 */
export function withFailOpen(primary: RequestHandler, fallback: RequestHandler, limiterName: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        primary(req, res, (err?: unknown) => {
            if (!err) {
                return next();
            }

            if (err instanceof AppError) {
                // Limite realmente excedido - erro intencional, repassa
                return next(err);
            }

            // Qualquer outro erro (ex: Redis fora do ar) = falha de infraestrutura
            console.error(`🔴 [RateLimiter:${limiterName}] Store indisponível, aplicando fail-open:`, (err as Error).message);
            return fallback(req, res, next);
        });
    };
}
