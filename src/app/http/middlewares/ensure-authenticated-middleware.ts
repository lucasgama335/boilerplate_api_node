import { AppError } from '@/app/exceptions/AppError';
import { ITokenValidityProvider } from '@/app/infra/token-validity/TokenValidityProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { NextFunction, Request, Response } from 'express';

interface TokenPayload {
    sub: string;
    iat: number;
    exp: number;
}

export function ensureAuthenticatedMiddleware(tokenProvider: ITokenProvider, tokenValidityProvider: ITokenValidityProvider) {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new AppError('Token JWT não informado.', 401);
        }

        const [, token] = authHeader.split(' ');
        // 1. Tenta decodificar o token. Se falhar (expirado, assinatura inválida, etc),
        // o catch captura e retorna o erro correto.
        let decoded: TokenPayload;
        try {
            decoded = tokenProvider.verify(token) as TokenPayload;
        } catch {
            throw new AppError('Token JWT inválido ou expirado.', 401);
        }

        // 2. Agora fazemos a checagem de revogação FORA do try/catch.
        // Se disparar o AppError aqui, ele vai direto para o handler global de erros da API.
        const revokedAt = await tokenValidityProvider.getRevokedAt(decoded.sub);

        if (revokedAt && decoded.iat < Math.floor(revokedAt.getTime() / 1000)) {
            throw new AppError('Sessão revogada. Faça login novamente.', 401);
        }

        // 3. Tudo certo! Passou em todas as validações, podemos injetar o user na Request.
        req.user = { id: decoded.sub };

        return next();
    };
}
