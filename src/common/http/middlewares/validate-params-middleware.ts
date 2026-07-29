import { NextFunction, Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { z } from 'zod';

export const validateParamsMiddleware = <T extends z.ZodTypeAny>(schema: T) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            // O Zod faz o parse e garantimos a compatibilidade com o ParamsDictionary do Express
            const parsedParams = await schema.parseAsync(req.params);
            req.params = parsedParams as ParamsDictionary;

            return next();
        } catch (error) {
            return next(error);
        }
    };
};
