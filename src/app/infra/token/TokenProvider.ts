import 'dotenv/config';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface ITokenProvider {
    generate(userId: string): string;
    verify(token: string): { sub: string };
}

export class TokenProvider implements ITokenProvider {
    generate(userId: string): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET não configurado no ambiente, verifique as variáveis de ambiente.');
        }

        return jwt.sign({ sub: userId }, secret, {
            expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_AT || '15m') as SignOptions['expiresIn'],
            algorithm: 'HS256',
        });
    }

    verify(token: string): { sub: string } {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET não configurado no ambiente, verifique as variáveis de ambiente.');
        }

        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
        return decoded as { sub: string };
    }
}
