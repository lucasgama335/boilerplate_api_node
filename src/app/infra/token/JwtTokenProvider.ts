import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { ITokenProvider } from './ITokenProvider';

export class JwtTokenProvider implements ITokenProvider {
    generate(userId: string): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET não configurado no ambiente, verifique as variáveis de ambiente.');
        }

        return jwt.sign({ sub: userId }, secret, {
            expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_AT || '15m') as any,
        });
    }

    verify(token: string, secret: string): jwt.JwtPayload | string {
        return jwt.verify(token, secret);
    }
}
