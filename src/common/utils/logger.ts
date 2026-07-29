import { env } from '@/env';
import pino from 'pino';

const isProduction = env.NODE_ENV === 'production';

export const logger = pino({
    level: env.LOG_LEVEL,

    // Camada extra de segurança: mesmo que algum código novo esqueça de sanitizar
    // o payload manualmente, isso impede que header de auth/cookie ou body.password
    // vazem pro log.
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'body.password',
            'body.passwordConfirmation',
            'body.oldPassword',
            'body.resetPasswordToken',
        ],
        censor: '[REDACTED]',
    },

    transport: {
        targets: [
            // Em produção: NDJSON puro no stdout, pra Datadog/CloudWatch conseguirem parsear.
            // Em dev: pino-pretty, legível no terminal.
            // Antes o pino-pretty estava fixo pros dois ambientes — o comentário original
            // dizia "em produção cospe JSON puro", mas isso nunca acontecia de fato.
            isProduction ? { target: 'pino/file', options: { destination: 1 }, level: 'info' } : { target: 'pino-pretty', options: { colorize: true }, level: 'info' },

            // Salva em Arquivo com Rotação (Log Rotation), em qualquer ambiente
            {
                target: 'pino-roll',
                options: {
                    file: './logs/error',
                    dateFormat: 'yyyy-MM-dd',
                    extension: '.log',
                    frequency: 'daily',
                    size: '10m',
                    mkdir: true,
                },
                level: 'error',
            },
        ],
    },
});
