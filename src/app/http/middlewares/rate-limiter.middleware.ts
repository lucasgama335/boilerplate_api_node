import { AppError } from '@/app/exceptions/AppError';
import { redisClient } from '@/app/infra/redis/redis-client';
import { logger } from '@/app/utils/logger';
import { rateLimit } from 'express-rate-limit';
import { RedisStore, SendCommandFn } from 'rate-limit-redis';
import { withFailOpen } from './with-fail-open';

const rateLimitHandlerIP = () => {
    throw new AppError('Muitas tentativas excedidas a partir deste IP. Tente novamente mais tarde.', 429);
};

const rateLimitHandlerAccount = () => {
    throw new AppError('Muitas tentativas excedidas a partir desta conta. Tente novamente mais tarde.', 429);
};

const getAccountKey = (email: string) => email.trim().toLowerCase();

/**
 * Envolve um rate limiter para que, se o STORE (Redis) falhar por motivo de
 * infraestrutura, a requisição passe direto (fail-open) em vez de travar
 * o endpoint inteiro. Um 429 legítimo (limite realmente excedido) continua
 * sendo bloqueado normalmente, porque é um AppError intencional.
 */

// --- RATE LIMITERS REDIS ---
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
                if (command?.toUpperCase() === 'SCRIPT') {
                    return 'dummy-sha-to-bypass-init-error';
                }
                throw error;
            }
        }) as SendCommandFn,
        prefix: 'rl:auth:ip:',
    }),
    handler: rateLimitHandlerIP,
});

export const accountLimiterRedis = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email : 'unknown';
        return getAccountKey(email);
    },
    store: new RedisStore({
        sendCommand: (async (...args: string[]) => {
            const [command, ...rest] = args;
            try {
                return await redisClient.call(command!, ...rest);
            } catch (error: unknown) {
                if (command?.toUpperCase() === 'SCRIPT') {
                    return 'dummy-sha-to-bypass-init-error';
                }
                throw error;
            }
        }) as SendCommandFn,
        prefix: 'rl:auth:account:',
    }),
    handler: rateLimitHandlerAccount,
});

// --- RATE LIMITERS FALLBACK (MEMÓRIA) ---
const ipLimiterMemoryFallback = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandlerIP,
});

const accountLimiterMemoryFallback = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Corrigido de 10 para 5 para manter consistência com o Redis
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Corrigido: Agora o Fallback também limita por e-mail!
        const email = typeof req.body?.email === 'string' ? req.body.email : 'unknown';
        return getAccountKey(email);
    },
    handler: rateLimitHandlerAccount,
});

export const authIpRateLimiter = withFailOpen(ipLimiterRedis, ipLimiterMemoryFallback, 'ip');
export const authAccountRateLimiter = withFailOpen(accountLimiterRedis, accountLimiterMemoryFallback, 'account');

/**
 * Limpa o contador de tentativas de login (tanto de IP quanto de Conta)
 * Deve ser chamada após um login efetuado com SUCESSO.
 */
export async function resetAuthRateLimits(ip: string, email: string): Promise<void> {
    const formattedEmail = getAccountKey(email);

    try {
        accountLimiterRedis.resetKey(formattedEmail);
        ipLimiterRedis.resetKey(ip);
    } catch (error) {
        // Não é crítico: o pior caso é a janela de rate limit expirar sozinha em até
        // 15min. Por isso warn (fica visível/buscável), sem Sentry — não vale o ruído.
        logger.warn({ err: error }, '[RateLimiter] Erro ao resetar chaves no Redis (silenciado)');
    }

    try {
        accountLimiterMemoryFallback.resetKey(formattedEmail);
        ipLimiterMemoryFallback.resetKey(ip);
    } catch (error) {
        logger.warn({ err: error }, '[RateLimiter] Erro ao resetar chaves no Fallback (silenciado)');
    }
}
