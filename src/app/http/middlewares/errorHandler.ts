import { AppError } from '@/app/exceptions/app-error';
import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    // 1. É um erro operacional previsto pelas nossas regras de negócio?
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ status: 'error', message: err.message });
    }

    // 2. Erro inesperado (Programmer Error / Banco de dados caiu / etc)
    // Imprimimos no console para o desenvolvedor investigar (ou enviamos para um Sentry/Datadog)
    console.error('🚨 [Unhandled Error]:', err);

    // Devolvemos uma mensagem genérica e opaca para o cliente, protegendo a infraestrutura
    return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
    });
}
