import { InMemoryUserRepository } from '@/modules/users/fakes/fake-users.repository';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryRedisCache } from '../fakes/fake-redis-cache';
import { UserSessionsRevocationProvider } from '../UserSessionsRevocationProvider';

describe('UserSessionRevocationProvider', () => {
    let usersRepository: InMemoryUserRepository;
    let cache: InMemoryRedisCache;
    let provider: UserSessionsRevocationProvider;

    beforeEach(() => {
        usersRepository = new InMemoryUserRepository();
        cache = new InMemoryRedisCache();
        provider = new UserSessionsRevocationProvider(usersRepository, cache);
    });

    describe('getRevokedAt', () => {
        it('deve retornar null quando o usuário nunca teve sessões revogadas', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });

            const result = await provider.getRevokedAt(user.id);

            expect(result).toBeNull();
        });

        it('deve buscar no banco e cachear corretamente quando o cache estiver vazio (cache miss)', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            const revokedAt = new Date('2026-01-01T00:00:00.000Z');
            await usersRepository.setTokensRevokedAt(user.id, revokedAt);

            const setSpy = vi.spyOn(cache, 'set');
            const dbSpy = vi.spyOn(usersRepository, 'getTokensRevokedAt');

            const result = await provider.getRevokedAt(user.id);

            expect(result).toEqual(revokedAt);
            expect(dbSpy).toHaveBeenCalledWith(user.id);
            // Garante que o timestamp foi serializado corretamente pro cache
            expect(setSpy).toHaveBeenCalledWith(`tokens-revoked-at:${user.id}`, revokedAt.getTime().toString(), 'EX', 300);
        });

        it('deve ler do cache sem consultar o banco (cache hit, usuário nunca revogado)', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            // Este é exatamente o caso do bug de serialização: a STRING 'null' no cache
            // precisa virar valor null, não permanecer como texto.
            await cache.set(`tokens-revoked-at:${user.id}`, 'null');

            const dbSpy = vi.spyOn(usersRepository, 'getTokensRevokedAt');

            const result = await provider.getRevokedAt(user.id);

            expect(result).toBeNull();
            expect(dbSpy).not.toHaveBeenCalled();
        });

        it('deve ler do cache sem consultar o banco (cache hit, com data revogada)', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            const revokedAt = new Date('2026-01-01T00:00:00.000Z');
            await cache.set(`tokens-revoked-at:${user.id}`, revokedAt.getTime().toString());

            const dbSpy = vi.spyOn(usersRepository, 'getTokensRevokedAt');

            const result = await provider.getRevokedAt(user.id);

            expect(result).toEqual(revokedAt);
            expect(dbSpy).not.toHaveBeenCalled();
        });

        it('deve cair pro banco (fail-open) quando o cache falhar na leitura', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            vi.spyOn(cache, 'get').mockRejectedValueOnce(new Error('Redis indisponível'));

            const result = await provider.getRevokedAt(user.id);

            expect(result).toBeNull();
        });

        it('não deve lançar erro quando o cache falhar na escrita', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            vi.spyOn(cache, 'set').mockRejectedValueOnce(new Error('Redis indisponível'));

            await expect(provider.getRevokedAt(user.id)).resolves.toBeNull();
        });
    });

    describe('revokeAllTokens', () => {
        it('deve marcar a revogação no banco e invalidar o cache', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            const cacheKey = `tokens-revoked-at:${user.id}`;
            await cache.set(cacheKey, 'null');

            await provider.revokeAllTokens(user.id);

            expect(await usersRepository.getTokensRevokedAt(user.id)).not.toBeNull();
            expect(await cache.get(cacheKey)).toBeNull();
        });

        it('não deve lançar erro quando o cache falhar ao invalidar', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            vi.spyOn(cache, 'del').mockRejectedValueOnce(new Error('Redis indisponível'));

            await expect(provider.revokeAllTokens(user.id)).resolves.not.toThrow();
            expect(await usersRepository.getTokensRevokedAt(user.id)).not.toBeNull();
        });
    });
});
