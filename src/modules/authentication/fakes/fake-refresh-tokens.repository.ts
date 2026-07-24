/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crypto from 'node:crypto';
import { RefreshToken } from '../authentication.types';
import { TransactionClient } from '../refresh-tokens.repository';

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
        db?: TransactionClient,
    ): Promise<string>;
    findByTokenHash(hashedToken: string): Promise<RefreshToken | null>;
    revokeToken(id: string, db?: TransactionClient): Promise<void>;
    revokeAllTokensByUser(userId: string, exceptTokenId?: string, db?: TransactionClient): Promise<void>;
    transaction<T>(fn: (db: any) => Promise<T>): Promise<T>;
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
        _db?: TransactionClient,
    ): Promise<string> {
        const id = crypto.randomUUID();

        const newToken: RefreshToken = {
            id,
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

    async revokeToken(id: string, _db?: TransactionClient): Promise<void> {
        const tokenRecord = this.items.find((item) => item.id === id);
        if (tokenRecord) {
            tokenRecord.revokedAt = new Date();
            tokenRecord.updatedAt = new Date();
        }
    }

    async revokeAllTokensByUser(userId: string, exceptHashedToken?: string, _db?: TransactionClient): Promise<void> {
        this.items.forEach((item) => {
            if (item.userId === userId) {
                const isExceptional = exceptHashedToken && item.hashedToken === exceptHashedToken;

                if (!isExceptional && !item.revokedAt) {
                    item.revokedAt = new Date();
                    item.updatedAt = new Date();
                }
            }
        });
    }

    // 👇 ADICIONADO: Executa a callback simulando uma transação em memória
    async transaction<T>(fn: (db: any) => Promise<T>): Promise<T> {
        return await fn(undefined);
    }
}
