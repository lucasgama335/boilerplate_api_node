import { env } from '@/env';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface ITokenProvider {
    generate(userId: string): string;
    generatePasswordResetToken(userId: string, passwordHash: string, lastLoginAt: Date | null): string;
    verify(token: string): { sub: string };
    verifyPasswordResetToken(userId: string, passwordHash: string, lastLoginAt: Date | null): { sub: string };
    decode(token: string): { sub: string };
}

export class TokenProvider implements ITokenProvider {
    generate(userId: string): string {
        return jwt.sign({ sub: userId }, env.JWT_SECRET, {
            expiresIn: env.ACCESS_TOKEN_EXPIRES_AT as SignOptions['expiresIn'],
            algorithm: 'HS256',
        });
    }

    generatePasswordResetToken(userId: string, passwordHash: string, lastLoginAt: Date | null): string {
        const loginTimestamp = lastLoginAt ? lastLoginAt.getTime() : 0;
        const dynamicSecret = `${env.JWT_SECRET}-${passwordHash}-${loginTimestamp}`;

        return jwt.sign({ sub: userId }, dynamicSecret, {
            expiresIn: env.RESET_PASSWORD_TOKEN_EXPIRES_AT as SignOptions['expiresIn'],
            algorithm: 'HS256',
        });
    }

    verify(token: string): { sub: string } {
        const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
        return decoded as { sub: string };
    }

    verifyPasswordResetToken(token: string, passwordHash: string, lastLoginAt: Date | null): { sub: string } {
        const loginTimestamp = lastLoginAt ? lastLoginAt.getTime() : 0;
        const dynamicSecret = `${env.JWT_SECRET}-${passwordHash}-${loginTimestamp}`;

        const decoded = jwt.verify(token, dynamicSecret, { algorithms: ['HS256'] });
        return decoded as { sub: string };
    }

    decode(token: string): { sub: string } {
        const decoded = jwt.decode(token);
        return decoded as { sub: string };
    }
}
