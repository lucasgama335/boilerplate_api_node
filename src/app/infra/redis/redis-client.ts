import 'dotenv/config';
import Redis from 'ioredis';

export const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true, // 👈 Não conecta imediatamente ao importar o arquivo
    enableOfflineQueue: false, // falha rápido, não enfileira comando esperando reconexão
    maxRetriesPerRequest: 1, // não fica tentando um comando várias vezes antes de desistir
    retryStrategy: (times) => Math.min(times * 200, 2000), // reconexão em BACKGROUND, sem travar requisições
});

redisClient.on('error', (err) => {
    console.error('🚨 [ioredis Error]:', err); // Debug no terminal
});
