import { AppError } from '@/app/exceptions/AppError';
import { redisClient } from '@/app/infra/redis/redis-client';
import { rateLimit } from 'express-rate-limit';
import { RedisStore, SendCommandFn } from 'rate-limit-redis';
import { withFailOpen } from './with-fail-open';

const rateLimitHandler = () => {
    throw new AppError('Muitas tentativas excedidas a partir deste IP. Tente novamente mais tarde.', 429);
};

/**
 * Envolve um rate limiter para que, se o STORE (Redis) falhar por motivo de
 * infraestrutura, a requisição passe direto (fail-open) em vez de travar
 * o endpoint inteiro. Um 429 legítimo (limite realmente excedido) continua
 * sendo bloqueado normalmente, porque é um AppError intencional.
 */

const ipLimiterRedis = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (async (...args: string[]) => {
            const [command, ...rest] = args;
            try {
                return await redisClient.call(command!, ...rest);
            } catch (error: unknown) {
                // Silencia apenas o erro chato do terminal na inicialização da API
                if (command?.toUpperCase() === 'SCRIPT') {
                    return 'dummy-sha-to-bypass-init-error';
                }
                // Deixa explodir na cara do withFailOpen durante o funcionamento normal!
                throw error;
            }
        }) as SendCommandFn,
        prefix: 'rl:auth:ip:',
    }),
    handler: rateLimitHandler,
});

export const accountLimiterRedis = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // mais restritivo que o de IP
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknow';
        return `account:${email}`;
    },
    store: new RedisStore({
        sendCommand: (async (...args: string[]) => {
            const [command, ...rest] = args;
            try {
                return await redisClient.call(command!, ...rest);
            } catch (error: unknown) {
                // Silencia apenas o erro chato do terminal na inicialização da API
                if (command?.toUpperCase() === 'SCRIPT') {
                    return 'dummy-sha-to-bypass-init-error';
                }
                // Deixa explodir na cara do withFailOpen durante o funcionamento normal!
                throw error;
            }
        }) as SendCommandFn,
        prefix: 'rl:auth:ip:',
    }),
    handler: rateLimitHandler,
});

// Fallback: em memória local, sem 'store' customizado = usa o MemoryStore padrão da lib
const ipLimiterMemoryFallback = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
});

const accountLimiterMemoryFallback = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
});

export const authIpRateLimiter = withFailOpen(ipLimiterRedis, ipLimiterMemoryFallback, 'ip');
export const authAccountRateLimiter = withFailOpen(accountLimiterRedis, accountLimiterMemoryFallback, 'account');
