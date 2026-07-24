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
                    // O %Y-%m-%d adiciona a data no nome (ex: error-2026-07-24.log)
                    file: './logs/error-%Y-%m-%d',
                    extension: '.log',

                    // Roda a cada virada de dia (meia-noite)
                    frequency: 'daily',

                    // SEGURANÇA EXTRA: Se o sistema surtar e gerar muitos erros no mesmo dia,
                    // ele quebra o arquivo ao atingir 10MB para não travar a memória.
                    size: '10m',

                    // Cria a pasta "logs" automaticamente se não existir
                    mkdir: true,
                },
                level: 'error', // Registra apenas os erros no arquivo
            },
        ],
    },
});
