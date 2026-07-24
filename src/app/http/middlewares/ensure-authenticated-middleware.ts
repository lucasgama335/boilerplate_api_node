import { AppError } from '@/app/exceptions/AppError';
import { ITokenProvider } from '@/app/infra/token/ITokenProvider';
import 'dotenv/config';
import { NextFunction, Request, Response } from 'express';

interface TokenPayload {
    sub: string;
    iat: number;
    exp: number;
}

export function ensureAuthenticatedMiddleware(tokenProvider: ITokenProvider) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new AppError('Token JWT não informado.', 401);
        }

        const [, token] = authHeader.split(' ');
        try {
            const decoded = tokenProvider.verify(token) as TokenPayload;
            req.user = { id: decoded.sub };
            return next();
        } catch {
            throw new AppError('Token JWT foi inválido ou expirado.', 401);
        }
    };
}
