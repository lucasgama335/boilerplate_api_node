import { logger } from '@/app/utils/logger';
import { env } from '@/env';
import * as Sentry from '@sentry/node';
import Redis from 'ioredis';

export const redisClient = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
});

// O ioredis reconecta sozinho (retryStrategy acima), então numa queda prolongada
// este handler dispara com muita frequência. Throttle simples pra não estourar
// quota do Sentry — o log continua registrando toda ocorrência, só o alerta é espaçado.
let lastReportedAt = 0;
const REPORT_INTERVAL_MS = 60_000;

redisClient.on('error', (err) => {
    logger.error({ err }, 'Erro de conexão com o Redis');

    const now = Date.now();
    if (now - lastReportedAt > REPORT_INTERVAL_MS) {
        lastReportedAt = now;
        Sentry.captureException(err, { tags: { component: 'redis-client' } });
    }
});
