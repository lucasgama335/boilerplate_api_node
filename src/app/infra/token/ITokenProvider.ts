import jwt from 'jsonwebtoken';

export interface ITokenProvider {
    generate(userId: string): string;
    verify(token: string, secret: string): jwt.JwtPayload | string;
}
