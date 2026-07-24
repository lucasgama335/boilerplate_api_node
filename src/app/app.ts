import { routes } from '@/routes';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './http/middlewares/error-handler-middleware';

export const app = express();

// Middlewares globais básicos
app.set('trust proxy', 1);
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
