// src/common/http/middlewares/with-fail-open.ts
import { AppError } from '@/common/exceptions/AppError';
import { logger } from '@/common/utils/logger';
import * as Sentry from '@sentry/node';
import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Envolve um rate limiter para que, se o STORE (Redis) falhar por motivo de
 * infraestrutura, a requisição passe direto (fail-open) em vez de travar
 * o endpoint inteiro. Um 429 legítimo (limite realmente excedido) continua
 * sendo bloqueado normalmente, porque é um AppError intencional.
 */

// Throttle por limiter, pro mesmo motivo do redis-client.ts: numa queda prolongada
// do Redis, cada requisição dispararia esse handler — sem throttle isso vira
// centenas de eventos de Sentry em minutos.
const lastReportedAtByLimiter = new Map<string, number>();
const REPORT_INTERVAL_MS = 60_000;

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
            const error = err as Error;
            logger.warn({ err: error, limiter: limiterName }, `[RateLimiter:${limiterName}] Store indisponível, aplicando fail-open`);

            const now = Date.now();
            const lastReportedAt = lastReportedAtByLimiter.get(limiterName) ?? 0;
            if (now - lastReportedAt > REPORT_INTERVAL_MS) {
                lastReportedAtByLimiter.set(limiterName, now);
                Sentry.captureException(error, { tags: { component: 'rate-limiter', limiter: limiterName } });
            }

            return fallback(req, res, next);
        });
    };
}
