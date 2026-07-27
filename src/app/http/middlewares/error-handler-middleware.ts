import { AppError } from '@/app/exceptions/AppError';
import { logger } from '@/app/utils/logger';
import { sanitizeBody } from '@/app/utils/sanitize-body';
import { env } from '@/env';
import * as Sentry from '@sentry/node';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

// Códigos SQLSTATE do Postgres que representam violação de integridade — não são bugs,
// são a constraint fazendo o trabalho dela (ex: corrida entre duas requisições tentando
// inserir o mesmo registro). Não vão pro Sentry por esse motivo.
const KNOWN_POSTGRES_ERROR_CODES: Record<string, { status: number; message: string }> = {
    '23505': { status: 409, message: 'Esse registro já existe.' },
    '23503': { status: 400, message: 'Um dos itens referenciados não existe.' },
    '23502': { status: 400, message: 'Um campo obrigatório não foi informado.' },
    '22P02': { status: 400, message: 'Um dos valores enviados tem formato inválido.' },
};

interface PostgresError extends Error {
    code?: string;
    detail?: string;
    constraint?: string;
}

function isPostgresError(err: unknown): err is PostgresError {
    return err instanceof Error && typeof (err as PostgresError).code === 'string' && /^[0-9A-Z]{5}$/.test((err as PostgresError).code!);
}

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
            errors: err.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })),
        });
    }

    // 3. ERROS DE SYNTAX
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({
            status: 'error',
            message: 'O JSON enviado possui uma sintaxe inválida. Verifique vírgulas sobrantes ou aspas.',
        });
    }

    // 4. Erro de integridade do Postgres (constraint fazendo seu trabalho, não um bug)
    if (isPostgresError(err)) {
        // Registra o erro real internamente com todos os detalhes
        logger.warn(
            {
                code: err.code,
                detail: err.detail,
                constraint: err.constraint,
            },
            'Database Error',
        );

        // Se for um erro conhecido (ex: FK não encontrada, Unique Constraint),
        // devolve a mensagem opaca de cliente com o status correto (400 ou 409)
        // independentemente do ambiente de execução.
        if (err.code && KNOWN_POSTGRES_ERROR_CODES[err.code]) {
            const { status, message } = KNOWN_POSTGRES_ERROR_CODES[err.code];
            return res.status(status).json({
                status: 'error',
                message: message,
            });
        }

        const safeBody = sanitizeBody(req.body);
        Sentry.captureException(err, {
            extra: { body: safeBody, params: req.params, query: req.query },
            user: req.user ? { id: req.user.id } : undefined,
            tags: { route: req.originalUrl, method: req.method },
        });

        // Retorno genérico para qualquer outro erro de banco (foreign key, syntax, etc)
        return res.status(500).json({
            status: 'error',
            message: 'Erro interno no processamento de dados.',
        });
    }

    // 5. Erros não tratados (Bugs inesperados de código, falha no banco, etc.)
    const safeBody = sanitizeBody(req.body);
    Sentry.captureException(err, {
        extra: { body: safeBody, params: req.params, query: req.query },
        user: req.user ? { id: req.user.id } : undefined,
        tags: { route: req.originalUrl, method: req.method },
    });

    logger.error({ err, method: req.method, path: req.originalUrl, body: safeBody, userId: req.user?.id }, 'Unhandled Server Error');

    if (env.NODE_ENV === 'development') {
        console.error('🚨 [Unhandled Error]:', err); // Debug no terminal
    }

    return res.status(500).json({
        status: 'error',
        message: 'Ocorreu um erro interno no servidor. Nossa equipe já foi notificada.',
    });
}
