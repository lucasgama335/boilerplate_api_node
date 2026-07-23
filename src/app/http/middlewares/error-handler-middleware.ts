import { AppError } from '@/app/exceptions/AppError';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
    // 1. É um erro operacional previsto pelas nossas regras de negócio?
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ status: 'error', message: err.message });
    }

    // 2. SE FOR UM ERRO GERADO PELO ZOD (Validação de Schema)
    if (err instanceof ZodError) {
        return res.status(400).json({
            status: 'error',
            message: 'Erro de validação nos campos enviados.',
            // Mapeamos os erros para o front-end saber exatamente qual campo falhou
            errors: err.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })), // <-- Note os parênteses envolvendo as chaves do objeto!
        });
    }

    // 3. Erros não tratados (Bugs inesperados de código, falha no banco, etc.)
    console.error('🚨 [Unhandled Error]:', err); // Debug no terminal
    return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
    });
}
