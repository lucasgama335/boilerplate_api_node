import cors from 'cors';
import express from 'express';
import { routes } from '../routes';
import { errorHandler } from './http/middlewares/errorHandler';

export const app = express();

// Middlewares globais básicos
app.use(cors());
app.use(express.json()); // Permite que o Express entenda JSON no body da requisição
app.use(routes);
// O interceptador de erros sempre no final!
app.use(errorHandler);
