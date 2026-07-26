import { IUsersRepository } from '@/modules/users/repositories/users.repository';
// Superfície mínima do cliente Redis que esta classe usa. Evita acoplar o provider
// ao tipo completo do ioredis e permite testar com um fake simples, sem mockar

// o módulo inteiro do redis-client.
export interface IRedisCache {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: 'EX', seconds: number): Promise<'OK' | null>;
    del(key: string): Promise<number>;
}

export interface IUserSessionsRevocationProvider {
    getRevokedAt(userId: string): Promise<Date | null>;
    revokeAllTokens(userId: string): Promise<void>;
}

export class UserSessionsRevocationProvider implements IUserSessionsRevocationProvider {
    constructor(
        private readonly userRepository: IUsersRepository,
        private readonly cache: IRedisCache,
    ) {}

    async getRevokedAt(userId: string): Promise<Date | null> {
        const cacheKey = `tokens-revoked-at:${userId}`;
        try {
            const cached = await this.cache.get(cacheKey);
            if (cached !== null) {
                return cached === 'null' ? null : new Date(Number(cached));
            }
        } catch {
            // Redis fora do ar: segue direto pro banco, não bloqueia nem ignora a checagem
        }

        const value = await this.userRepository.getTokensRevokedAt(userId);
        try {
            await this.cache.set(cacheKey, value ? value.getTime().toString() : 'null', 'EX', 300); // cache 5min
        } catch {
            // cache indisponível não deveria travar o fluxo
        }

        return value;
    }

    async revokeAllTokens(userId: string): Promise<void> {
        const now = new Date();
        await this.userRepository.setTokensRevokedAt(userId, now);

        try {
            await this.cache.del(`tokens-revoked-at:${userId}`); // invalida cache pra refletir imediatamente
        } catch {
            // se o del falhar, o pior caso é o cache antigo durar até 5min a mais - aceitável
        }
    }
}
