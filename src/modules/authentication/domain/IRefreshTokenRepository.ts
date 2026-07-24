import { RefreshToken } from './RefreshToken';

export interface IRefreshTokenRepository {
    create(userId: string, hashedToken: string, expiresAt: Date): Promise<string>;
    findByTokenHash(hashedToken: string): Promise<RefreshToken | null>;
    revokeToken(id: string): Promise<void>;
    revokeAllTokensByUser(userId: string): Promise<void>;
}
