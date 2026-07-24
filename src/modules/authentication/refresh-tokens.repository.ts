import { DatabaseType } from '@/database';
import { refreshTokens } from '@/database/schema';
import { and, eq, isNotNull, not } from 'drizzle-orm';
import { RefreshToken } from './authentication.types';

export type TransactionClient = Parameters<Parameters<DatabaseType['transaction']>[0]>[0];

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
        db?: TransactionClient,
    ): Promise<string>;
    findByTokenHash(hashedToken: string): Promise<RefreshToken | null>;
    revokeToken(id: string, db?: TransactionClient): Promise<void>;
    revokeAllTokensByUser(userId: string, exceptTokenId?: string, db?: TransactionClient): Promise<void>;
    transaction<T>(fn: (db: TransactionClient) => Promise<T>): Promise<T>;
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
        db?: TransactionClient,
    ): Promise<string> {
        const executor = db || this.db;
        const [tokenRecord] = await executor
            .insert(refreshTokens)
            .values({
                userId,
                hashedToken,
                expiresAt,
                revokedAt: null,
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

    async revokeToken(id: string, db?: TransactionClient): Promise<void> {
        const executor = db || this.db;
        await executor.update(refreshTokens).set({ revokedAt: new Date(), updatedAt: new Date() }).where(eq(refreshTokens.id, id));
    }

    async revokeAllTokensByUser(userId: string, exceptTokenId?: string, db?: TransactionClient): Promise<void> {
        const executor = db || this.db;
        const conditions = [eq(refreshTokens.userId, userId), isNotNull(refreshTokens.revokedAt)];

        if (exceptTokenId) {
            conditions.push(not(eq(refreshTokens.hashedToken, exceptTokenId)));
        }

        await executor
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(and(eq(refreshTokens.userId, userId), ...conditions));
    }

    // 👇 ADICIONE ESTE MÉTODO NA CLASSE CONCRETA
    async transaction<T>(fn: (db: TransactionClient) => Promise<T>): Promise<T> {
        return await this.db.transaction(fn);
    }
}
