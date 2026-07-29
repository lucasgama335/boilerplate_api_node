import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export const validateDataMiddleware = <T extends z.ZodTypeAny>(schema: T) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            req.body = await schema.parseAsync(req.body);
            // Se passou com sucesso, o fluxo continua para o Controller
            return next();
        } catch (error) {
            // Se o Zod falhar, o erro (ZodError) é passado para o next(error).
            // O Express vai capturá-lo e enviá-lo direto para o nosso errorHandler global!
            return next(error);
        }
    };
};
