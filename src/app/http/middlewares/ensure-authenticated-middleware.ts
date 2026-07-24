import { AppError } from '@/app/exceptions/AppError';
import { JwtTokenProvider } from '@/app/infra/token/JwtTokenProvider';
import 'dotenv/config';
import { NextFunction, Request, Response } from 'express';

interface TokenPayload {
    sub: string;
    iat: number;
    exp: number;
}

export function ensureAuthenticatedMiddleware(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new AppError('Token JWT não informado.', 401);
    }

    const [, token] = authHeader.split(' ');
    try {
        const tokenProvider = new JwtTokenProvider();
        const decoded = tokenProvider.verify(token) as TokenPayload;
        // Injeta o ID do usuário na requisição para uso nos controllers
        req.user = {
            id: decoded.sub,
        };

        return next();
    } catch (error) {
        // Se o token estiver expirado ou adulterado, o verify dispara erro
        throw new AppError('Token JWT foi inválido ou expirado.', 401);
    }
}
