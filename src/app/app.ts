import { routes } from '@/routes';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './http/middlewares/error-handler-middleware';

export const app = express();

// Middlewares globais básicos
app.use(cors());
app.use(express.json()); // Permite que o Express entenda JSON no body da requisição

// Pluga o nosso Hub Central de rotas na aplicação com o prefixo '/api'
// Agora a nossa rota final será: POST /api/auth/register
app.use('/api', routes);

// O interceptador de erros sempre no final!
app.use(errorHandler);
