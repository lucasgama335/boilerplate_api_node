import { DatabaseType } from '@/database';
import { refreshTokens } from '@/database/schema';
import { and, eq, not } from 'drizzle-orm';
import { RefreshToken } from './authentication.types';

export interface IRefreshTokenRepository {
    create(
        userId: string,
        hashedToken: string,
        expiresAt: Date,
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
    ): Promise<string>;
    findByTokenHash(hashedToken: string): Promise<RefreshToken | null>;
    revokeToken(id: string): Promise<void>;
    revokeAllTokensByUser(userId: string, exceptTokenId?: string): Promise<void>;
}

export class DrizzleRefreshTokenRepository implements IRefreshTokenRepository {
    constructor(private readonly db: DatabaseType) {}

    async create(
        userId: string,
        hashedToken: string,
        expiresAt: Date,
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
    ): Promise<string> {
        const [tokenRecord] = await this.db
            .insert(refreshTokens)
            .values({
                userId,
                hashedToken,
                expiresAt,
                revoked: false,
                ipAddress,
                city,
                region,
                country,
                os,
                deviceType,
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

    async revokeAllTokensByUser(userId: string, exceptTokenId?: string): Promise<void> {
        const conditions = [eq(refreshTokens.userId, userId)];

        // Se a intenção for manter a sessão atual, adicionamos a restrição na query
        if (exceptTokenId) {
            conditions.push(not(eq(refreshTokens.hashedToken, exceptTokenId)));
        }

        await this.db
            .update(refreshTokens)
            .set({ revoked: true })
            .where(and(...conditions));
    }
}
