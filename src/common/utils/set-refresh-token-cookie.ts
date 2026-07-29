import { env } from '@/env';
import { Response } from 'express';

export function setRefreshTokenCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie('refreshToken', token, {
        httpOnly: true, // Impede acesso via JavaScript (XSS)
        secure: env.NODE_ENV === 'production', // Só trafega em HTTPS na produção
        sameSite: 'strict', // Proteção contra CSRF (mude para 'lax' se frontend e API estiverem em domínios diferentes e houver redirecionamento de navegação)
        expires: expiresAt,
        path: env.AUTH_ROUTE_PREFIX, // Escopo reduzido: o cookie só é enviado para a rota que precisa dele
    });
}
