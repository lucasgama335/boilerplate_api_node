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
            // 2. Manda para um Arquivo de texto
            {
                target: 'pino/file',
                options: {
                    destination: './logs/error.log', // Onde o arquivo será salvo
                    mkdir: true, // Cria a pasta 'logs' automaticamente se não existir
                },
                level: 'error', // Dica: Só mande 'error' para o arquivo, assim seu disco não enche de logs de 'info'
            },
        ],
    },
});
