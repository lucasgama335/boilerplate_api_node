import { AppError } from '@/app/exceptions/AppError';
import { logger } from '@/app/utils/logger';
import { sanitizeBody } from '@/app/utils/sanitize-body';
import { env } from '@/env';
import * as Sentry from '@sentry/node';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
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
    // Nunca repassamos req.body cru: em /auth/register e /auth/login ele contém senha
    // em texto claro, e isso não pode ir pro Sentry nem pro disco.
    const safeBody = sanitizeBody(req.body);
    Sentry.captureException(err, {
        extra: {
            body: safeBody,
            params: req.params,
            query: req.query,
        },
        user: req.user ? { id: req.user.id } : undefined,
        tags: {
            route: req.originalUrl,
            method: req.method,
        },
    });

    logger.error(
        {
            err,
            method: req.method,
            path: req.originalUrl,
            body: safeBody,
            userId: req.user?.id,
        },
        'Unhandled Server Error',
    );

    if (env.NODE_ENV === 'development') {
        console.error('🚨 [Unhandled Error]:', err); // Debug no terminal
    }
    return res.status(500).json({
        status: 'error',
        message: 'Ocorreu um erro interno no servidor. Nossa equipe já foi notificada.',
    });
}
