import * as crypto from 'node:crypto';
import { RefreshToken } from '../authentication.types';

export interface IFakeRefreshTokenRepository {
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

export class InMemoryRefreshTokenRepository implements IFakeRefreshTokenRepository {
    public items: RefreshToken[] = [];

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
        const id = crypto.randomUUID();

        const newToken: RefreshToken = {
            id,
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
            browser: 'Mozilla',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.items.push(newToken);

        return id;
    }

    async findByTokenHash(hashedToken: string): Promise<RefreshToken | null> {
        const tokenRecord = this.items.find((item) => item.hashedToken === hashedToken);
        return tokenRecord || null;
    }

    async revokeToken(id: string): Promise<void> {
        const tokenRecord = this.items.find((item) => item.id === id);
        if (tokenRecord) {
            tokenRecord.revoked = true;
            tokenRecord.updatedAt = new Date();
        }
    }

    async revokeAllTokensByUser(userId: string, exceptTokenId?: string): Promise<void> {
        this.items.forEach((item) => {
            if (item.userId === userId) {
                // Mantém o comportamento do Drizzle onde o exceptTokenId é comparado com o hashedToken
                const isExceptional = exceptTokenId && item.hashedToken === exceptTokenId;

                if (!isExceptional) {
                    item.revoked = true;
                    item.updatedAt = new Date();
                }
            }
        });
    }
}
