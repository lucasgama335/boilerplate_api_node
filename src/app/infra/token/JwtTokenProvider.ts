import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { ITokenProvider } from './ITokenProvider';

export class JwtTokenProvider implements ITokenProvider {
    generate(userId: string): string {
        const secret = process.env.JWT_SECRET || 'default_secret_fallback';

        return jwt.sign({ sub: userId }, secret, {
            expiresIn: '15m',
        });
    }
}
