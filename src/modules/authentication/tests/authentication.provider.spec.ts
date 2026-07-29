/* eslint-disable @typescript-eslint/no-explicit-any */
import { IRedisCache, UserSessionsRevocationProvider } from '@/modules/authentication/providers/authentication.provider';
import { InMemoryUsersRepository } from '@/modules/users/tests/repositories/in-memory-users.repository';
import { User } from '@/modules/users/types/users.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class InMemoryRedisCache implements IRedisCache {
    private readonly store = new Map<string, string>();

    public shouldThrowOnGet = false;
    public shouldThrowOnSet = false;
    public shouldThrowOnDel = false;

    async get(key: string): Promise<string | null> {
        if (this.shouldThrowOnGet) throw new Error('Redis indisponível (simulado)');
        return this.store.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<'OK' | null> {
        if (this.shouldThrowOnSet) throw new Error('Redis indisponível (simulado)');
        this.store.set(key, value);
        return 'OK';
    }

    async del(key: string): Promise<number> {
        if (this.shouldThrowOnDel) throw new Error('Redis indisponível (simulado)');
        const existed = this.store.has(key);
        this.store.delete(key);
        return existed ? 1 : 0;
    }

    public has(key: string): boolean {
        return this.store.has(key);
    }

    public seed(key: string, value: string): void {
        this.store.set(key, value);
    }
}

function buildUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        passwordHash: 'hash',
        isEmailConfirmed: true,
        isSuperUser: false,
        totpSecret: null,
        isTwoFactorEnabled: false,
        tokensRevokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        ...overrides,
    };
}

describe('[UNIT TEST]: UserSessionsRevocationProvider', () => {
    let userRepository: InMemoryUsersRepository;
    let cache: InMemoryRedisCache;

    let service: UserSessionsRevocationProvider;

    beforeEach(() => {
        userRepository = new InMemoryUsersRepository();
        cache = new InMemoryRedisCache();

        service = new UserSessionsRevocationProvider(userRepository, cache);
    });

    describe('[method]: #getRevokedAt', () => {
        it('deve retornar do cache (cache hit) sem consultar o repositório, convertendo o timestamp de volta pra Date', async () => {
            const revokedDate = new Date('2026-03-10T12:00:00.000Z');
            cache.seed('tokens-revoked-at:user-1', revokedDate.getTime().toString());
            const spyRepo = vi.spyOn(userRepository, 'getTokensRevokedAt');

            const result = await service.getRevokedAt('user-1');

            expect(result).toEqual(revokedDate);
            expect(spyRepo).not.toHaveBeenCalled();
        });

        it('deve retornar null quando o cache tem a string literal "null" (usuário nunca revogado)', async () => {
            cache.seed('tokens-revoked-at:user-1', 'null');
            const spyRepo = vi.spyOn(userRepository, 'getTokensRevokedAt');

            const result = await service.getRevokedAt('user-1');

            expect(result).toBeNull();
            expect(spyRepo).not.toHaveBeenCalled();
        });

        it('deve consultar o repositório e gravar no cache quando houver cache miss', async () => {
            const revokedDate = new Date('2026-03-10T12:00:00.000Z');
            const user = buildUser({ id: 'user-1', tokensRevokedAt: revokedDate });
            await userRepository.create({ ...user, passwordHash: user.passwordHash } as any);
            vi.spyOn(userRepository, 'getTokensRevokedAt').mockResolvedValue(revokedDate);

            const result = await service.getRevokedAt('user-1');

            expect(result).toEqual(revokedDate);
            expect(cache.has('tokens-revoked-at:user-1')).toBe(true);
        });

        it('deve gravar "null" no cache (não a ausência da chave) quando o usuário nunca teve sessões revogadas', async () => {
            vi.spyOn(userRepository, 'getTokensRevokedAt').mockResolvedValue(null);

            const result = await service.getRevokedAt('user-1');

            expect(result).toBeNull();
            expect(cache.has('tokens-revoked-at:user-1')).toBe(true);
        });

        it('deve cair para o repositório (fail-open) quando o Redis falha na leitura', async () => {
            const revokedDate = new Date('2026-03-10T12:00:00.000Z');
            vi.spyOn(userRepository, 'getTokensRevokedAt').mockResolvedValue(revokedDate);
            cache.shouldThrowOnGet = true;

            await expect(service.getRevokedAt('user-1')).resolves.toEqual(revokedDate);
        });

        it('não deve lançar erro (fail-open) quando o Redis falha ao gravar no cache', async () => {
            const revokedDate = new Date('2026-03-10T12:00:00.000Z');
            vi.spyOn(userRepository, 'getTokensRevokedAt').mockResolvedValue(revokedDate);
            cache.shouldThrowOnSet = true;

            await expect(service.getRevokedAt('user-1')).resolves.toEqual(revokedDate);
        });
    });

    describe('[method]: #revokeAllTokens', () => {
        it('deve persistir o momento da revogação no banco de dados', async () => {
            const spySetRevoked = vi.spyOn(userRepository, 'setTokensRevokedAt');

            await service.revokeAllTokens('user-1');

            expect(spySetRevoked).toHaveBeenCalledWith('user-1', expect.any(Date));
        });

        it('deve apagar a chave do cache para refletir a revogação imediatamente (não esperar o TTL)', async () => {
            cache.seed('tokens-revoked-at:user-1', 'null');

            await service.revokeAllTokens('user-1');

            expect(cache.has('tokens-revoked-at:user-1')).toBe(false);
        });

        it('não deve lançar erro (fail-open) quando o Redis falha ao apagar a chave — a revogação no banco já é o suficiente', async () => {
            cache.shouldThrowOnDel = true;
            const spySetRevoked = vi.spyOn(userRepository, 'setTokensRevokedAt');

            await expect(service.revokeAllTokens('user-1')).resolves.toBeUndefined();
            expect(spySetRevoked).toHaveBeenCalled();
        });
    });
});
