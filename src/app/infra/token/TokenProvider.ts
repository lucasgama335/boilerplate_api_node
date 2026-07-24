import { env } from '@/env';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface ITokenProvider {
    generate(userId: string): string;
    verify(token: string): { sub: string };
}

export class TokenProvider implements ITokenProvider {
    generate(userId: string): string {
        return jwt.sign({ sub: userId }, env.JWT_SECRET, {
            expiresIn: env.ACCESS_TOKEN_EXPIRES_AT as SignOptions['expiresIn'],
            algorithm: 'HS256',
        });
    }

    verify(token: string): { sub: string } {
        const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
        return decoded as { sub: string };
    }
}
