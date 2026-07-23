export interface IRefreshTokenRepository {
    create(userId: string, hashedToken: string, expiresAt: Date): Promise<string>;
    findByTokenHash(hashedToken: string): Promise<any | null>;
    revokeToken(id: string): Promise<void>;
}
