import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    // Em desenvolvimento, usa o pino-pretty para ficar legível.
    // Em produção (NODE_ENV=production), cospe JSON puro (mais rápido e ideal para AWS/Datadog).
    transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
