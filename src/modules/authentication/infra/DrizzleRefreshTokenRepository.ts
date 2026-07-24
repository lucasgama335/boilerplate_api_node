import { DatabaseType } from '@/database';
import { refreshTokens } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { IRefreshTokenRepository } from '../domain/IRefreshTokenRepository';
import { RefreshToken } from '../domain/RefreshToken';

export class DrizzleRefreshTokenRepository implements IRefreshTokenRepository {
    constructor(private readonly db: DatabaseType) {}

    async create(userId: string, hashedToken: string, expiresAt: Date): Promise<string> {
        const [tokenRecord] = await this.db
            .insert(refreshTokens)
            .values({
                userId,
                hashedToken,
                expiresAt,
                revoked: false,
            })
            .returning();

        return tokenRecord.id;
    }

    async findByTokenHash(hashedToken: string): Promise<RefreshToken | null> {
        const [tokenRecord] = await this.db.select().from(refreshTokens).where(eq(refreshTokens.hashedToken, hashedToken));

        return tokenRecord || null;
    }

    async revokeToken(id: string): Promise<void> {
        await this.db.update(refreshTokens).set({ revoked: true, updatedAt: new Date() }).where(eq(refreshTokens.id, id)).returning();
    }

    async revokeAllTokensByUser(userId: string): Promise<void> {
        await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    }
}
