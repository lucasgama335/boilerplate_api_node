import { TransactionClient } from '@/database';
import { IRefreshTokensRepository } from '../../repositories/refresh-tokens.repository';
import { RefreshToken } from '../../types/authentication.types';

export class InMemoryRefreshTokensRepository implements IRefreshTokensRepository {
    // ---------------------------------------------------------
    // Estrutura auxiliar pública para popular os dados nos testes
    // ---------------------------------------------------------
    public items: RefreshToken[] = [];

    // ---------------------------------------------------------
    // Implementação da Interface
    // ---------------------------------------------------------

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
        const newToken: RefreshToken = {
            id: `rt-${Math.random().toString(36).substring(2, 9)}`,
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
            browser: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.items.push(newToken);
        return newToken.id;
    }

    async findByTokenHash(hashedToken: string): Promise<RefreshToken | null> {
        return this.items.find((token) => token.hashedToken === hashedToken) || null;
    }

    async revokeToken(id: string, _db?: TransactionClient): Promise<void> {
        const tokenIndex = this.items.findIndex((token) => token.id === id);

        if (tokenIndex !== -1) {
            this.items[tokenIndex].revokedAt = new Date();
            this.items[tokenIndex].updatedAt = new Date();
        }
    }

    async revokeAllTokensByUser(userId: string, exceptHashedToken?: string, _db?: TransactionClient): Promise<void> {
        const now = new Date();

        for (let i = 0; i < this.items.length; i++) {
            const token = this.items[i];

            // Aplica exatamente a mesma regra: Pertence ao usuário e ainda não foi revogado (revokedAt IS NULL)
            if (token.userId === userId && token.revokedAt === null) {
                // Se o token for a exceção, pula a iteração
                if (exceptHashedToken && token.hashedToken === exceptHashedToken) {
                    continue;
                }

                this.items[i].revokedAt = now;
                this.items[i].updatedAt = now;
            }
        }
    }

    async transaction<T>(fn: (db: TransactionClient) => Promise<T>): Promise<T> {
        // Em memória, apenas executamos o callback imediatamente.
        // Passamos um objeto vazio (cast para TransactionClient) apenas para satisfazer o TypeScript.
        // Isso permite que o Service use transactions nativamente sem quebrar os testes.
        return await fn({} as TransactionClient);
    }
}
