import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export const validateQueryMiddleware = <T extends z.ZodTypeAny>(schema: T) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const parsedQuery = await schema.parseAsync(req.query);

            // 🛡️ Como req.query é somente leitura (possui apenas getter),
            // limpamos as chaves antigas e atribuímos as novas validadas/coercidas:
            for (const key in req.query) {
                delete req.query[key];
            }
            Object.assign(req.query, parsedQuery);

            return next();
        } catch (error) {
            return next(error);
        }
    };
};
