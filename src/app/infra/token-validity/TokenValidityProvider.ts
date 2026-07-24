// src/app/infra/token-validity/token-validity.provider.ts
import { redisClient } from '@/app/infra/redis/redis-client';
import { IUserRepository } from '@/modules/users/users.repository';

export interface ITokenValidityProvider {
    getRevokedAt(userId: string): Promise<Date | null>;
    revokeAllTokens(userId: string): Promise<void>;
}

export class TokenValidityProvider implements ITokenValidityProvider {
    constructor(private readonly userRepository: IUserRepository) {}

    async getRevokedAt(userId: string): Promise<Date | null> {
        const cacheKey = `tokens-revoked-at:${userId}`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached !== null) {
                return cached === 'null' ? null : new Date(Number(cached));
            }
        } catch {
            // Redis fora do ar: segue direto pro banco, não bloqueia nem ignora a checagem
        }

        const value = await this.userRepository.getTokensRevokedAt(userId);
        try {
            await redisClient.set(cacheKey, value ? value.getTime().toString() : 'null', 'EX', 300); // cache 5min
        } catch {
            // cache indisponível não deveria travar o fluxo
        }

        return value;
    }

    async revokeAllTokens(userId: string): Promise<void> {
        const now = new Date();
        await this.userRepository.setTokensRevokedAt(userId, now);

        try {
            await redisClient.del(`tokens-revoked-at:${userId}`); // invalida cache pra refletir imediatamente
        } catch {
            // se o del falhar, o pior caso é o cache antigo durar até 5min a mais - aceitável
        }
    }
}
