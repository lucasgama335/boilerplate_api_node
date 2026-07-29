import { env } from '@/env';
import { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { setRefreshTokenCookie } from '../set-refresh-token-cookie';

describe('[UNIT TEST]: Util - Set Refresh Token Cookie', () => {
    it('deve injetar o cookie no objeto de Response com todas as bandeiras de segurança', () => {
        // Mockamos o objeto Res do Express que possui o método 'cookie'
        const mockRes = {
            cookie: vi.fn(),
        } as unknown as Response;

        const token = 'super-secure-refresh-token';
        const expiresAt = new Date('2026-12-31T00:00:00.000Z');

        setRefreshTokenCookie(mockRes, token, expiresAt);

        // Garante que as bandeiras Anti-XSS (httpOnly) e Anti-CSRF (sameSite) foram passadas
        expect(mockRes.cookie).toHaveBeenCalledWith('refreshToken', token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: 'strict',
            expires: expiresAt,
            path: env.AUTH_ROUTE_PREFIX,
        });
    });
});
