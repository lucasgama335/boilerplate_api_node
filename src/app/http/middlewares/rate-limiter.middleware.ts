import { AppError } from '@/app/exceptions/AppError';
import { redisClient } from '@/app/infra/redis/redis-client';
import { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Limite de 10 tentativas por IP
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        // Força a compatibilidade exata com o tipo SendCommandFn esperado pelo store
        sendCommand: (async (args: string[]) => {
            const [command, ...parameters] = args;
            return await redisClient.call(command, ...parameters);
        }) as any,
        prefix: 'rl:auth:',
    }),
    handler: (_req: Request, _res: Response) => {
        throw new AppError('Muitas tentativas excedidas a partir deste IP. Tente novamente mais tarde.', 429);
    },
});
