import { env } from '@/env';
import * as Sentry from '@sentry/node';

// Inicialize o Sentry o mais cedo possível
// Se SENTRY_TRACES_SAMPLE_RATE não for definida, cai no default por ambiente:
// produção amostra 20% das transações (suficiente pra ter sinal estatístico sem
// pagar o custo de rastrear cada requisição); fora de produção amostra tudo,
// já que o volume de tráfego é baixo o bastante pra isso não custar nada.
const defaultTracesSampleRate = env.NODE_ENV === 'production' ? 0.2 : 1.0;
Sentry.init({
    dsn: env.SENTRY_DSN, // Você pega essa URL gratuita criando uma conta no Sentry.io
    environment: env.NODE_ENV || 'development',
    enableLogs: true,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE ?? defaultTracesSampleRate,
});

import { logger } from '@/app/utils/logger';
import { routes } from '@/routes';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { errorHandler } from './http/middlewares/error-handler-middleware';

export const app = express();

app.set('trust proxy', env.TRUST_PROXY_HOPS); // Número reais de proxys que batem na API
app.use(helmet()); // Camada de segurança que modifica os headers
app.use(
    // Loga toda requisição (método, rota, status, duração). Antes só existia log quando dava erro — não tinha como ver tráfego normal nem correlacionar uma reclamação de usuário com o que aconteceu no servidor.
    pinoHttp({
        logger,
        customLogLevel: (_req, res, err) => {
            // classifica a gravidade dos erros a partir do status code
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
    }),
);
app.use(
    cors({
        origin: env.FRONTEND_URL, // nunca '*' quando usa cookies/credentials
        credentials: true, // permite o navegador enviar/receber cookies
    }),
);
app.use(cookieParser());
app.use(express.json()); // Permite que o Express entenda JSON no body da requisição
app.use('/api', routes); // Pluga o nosso Hub Central de rotas na aplicação com o prefixo '/api'
app.use(errorHandler); // O interceptador de erros sempre no final!
