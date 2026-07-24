import { env } from '@/env';
import { Response } from 'express';

export function setRefreshTokenCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production', // exige HTTPS em produção
        sameSite: 'strict',
        path: '/api/auth', // só é enviado pras rotas de auth (refresh/logout), não em toda API
        expires: expiresAt,
    });
}
