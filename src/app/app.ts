import * as Sentry from '@sentry/node';

// Inicialize o Sentry o mais cedo possível
Sentry.init({
    dsn: process.env.SENTRY_DSN, // Você pega essa URL gratuita criando uma conta no Sentry.io
    environment: process.env.NODE_ENV || 'development',
    enableLogs: true,
    // tracesSampleRate de 1.0 captura 100% das transações para métricas de performance.
    // Em produção com alto tráfego, você pode reduzir para 0.2 (20%).
    tracesSampleRate: 1.0,
});

import { routes } from '@/routes';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './http/middlewares/error-handler-middleware';

export const app = express();

// Middlewares globais básicos
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 0); // Número reais de proxys que batem na API
app.use(
    cors({
        origin: process.env.FRONTEND_URL, // nunca '*' quando usa cookies/credentials
        credentials: true, // permite o navegador enviar/receber cookies
    }),
);
app.use(cookieParser());
app.use(express.json()); // Permite que o Express entenda JSON no body da requisição

// Pluga o nosso Hub Central de rotas na aplicação com o prefixo '/api'
// Agora a nossa rota final será: POST /api/auth/register
app.use('/api', routes);

// O interceptador de erros sempre no final!
app.use(errorHandler);
