import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    // Em desenvolvimento, usa o pino-pretty para ficar legível.
    // Em produção (NODE_ENV=production), cospe JSON puro (mais rápido e ideal para AWS/Datadog).
    transport: {
        // 'targets' permite enviar o log para vários lugares ao mesmo tempo
        targets: [
            // 1. Manda pro Console (com pino-pretty pra ficar legível)
            {
                target: 'pino-pretty',
                options: { colorize: true },
                level: 'info',
            },
            // 2. Salva em Arquivo com Rotação (Log Rotation)
            {
                target: 'pino-roll',
                options: {
                    // O nome base do arquivo (sem data e sem extensão)
                    file: './logs/error',

                    // O formato da data que será injetado (padrão yyyy-MM-dd)
                    dateFormat: 'yyyy-MM-dd',

                    // A extensão que vai no final de tudo
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
