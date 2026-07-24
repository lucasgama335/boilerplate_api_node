import { env } from '@/env';
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

redisClient.on('error', (err) => {
    console.error('🚨 [ioredis Error]:', err); // Debug no terminal
});
