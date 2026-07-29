import { IRedisCache, UserPermissionsService } from '@/app/services/user-permissions/UserPermissionsService';
import { IUserDepartmentsRepository } from '@/modules/departments/repositories/user-departments.repository';
import { Permission } from '@/modules/permissions/types/permissions.types';
import { InMemoryUserPermissionsRepository } from '@/modules/user-access/tests/repositories/in-memory-user-access.repository';
import { User } from '@/modules/users/types/users.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fakes locais (ainda não existem no projeto para estas duas interfaces)
// ---------------------------------------------------------------------------

class InMemoryUserDepartmentsRepository implements IUserDepartmentsRepository {
    // userId -> departmentIds[]
    public userDepartmentsMap: Map<string, string[]> = new Map();

    async getDepartmentsByUserId(userId: string): Promise<string[]> {
        return this.userDepartmentsMap.get(userId) || [];
    }

    async getDepartmentUsers(departmentId: string): Promise<string[]> {
        return [...this.userDepartmentsMap.entries()].filter(([, deptIds]) => deptIds.includes(departmentId)).map(([userId]) => userId);
    }

    async setDepartment(userId: string, departmentId: string): Promise<void> {
        const current = this.userDepartmentsMap.get(userId) || [];
        if (!current.includes(departmentId)) {
            this.userDepartmentsMap.set(userId, [...current, departmentId]);
        }
    }

    async removeDepartment(userId: string, departmentId: string): Promise<void> {
        const current = this.userDepartmentsMap.get(userId) || [];
        this.userDepartmentsMap.set(
            userId,
            current.filter((id) => id !== departmentId),
        );
    }

    async removeAllDepartments(userId: string): Promise<void> {
        this.userDepartmentsMap.delete(userId);
    }
}

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

function buildPermission(overrides: Partial<Permission> = {}): Permission {
    return {
        id: 'perm-1',
        code: 'users:show',
        description: 'Ver usuário',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

describe('[UNIT TEST]: UserPermissionsService', () => {
    let userPermissionsRepository: InMemoryUserPermissionsRepository;
    let userDepartmentsRepository: InMemoryUserDepartmentsRepository;
    let cache: InMemoryRedisCache;

    let service: UserPermissionsService;

    beforeEach(() => {
        userPermissionsRepository = new InMemoryUserPermissionsRepository();
        userDepartmentsRepository = new InMemoryUserDepartmentsRepository();
        cache = new InMemoryRedisCache();

        service = new UserPermissionsService(userPermissionsRepository, userDepartmentsRepository, cache);
    });

    describe('[method]: #getPermissions', () => {
        it('deve retornar do cache (cache hit) sem consultar o repositório', async () => {
            cache.seed('user-permissions:user-1', JSON.stringify(['users:show']));
            const spyRepo = vi.spyOn(userPermissionsRepository, 'getPermissionsCode');

            const result = await service.getPermissions('user-1');

            expect(result).toEqual(['users:show']);
            expect(spyRepo).not.toHaveBeenCalled();
        });

        it('deve consultar o repositório e gravar no cache quando houver cache miss', async () => {
            userPermissionsRepository.users.push(buildUser({ id: 'user-1' }));
            userPermissionsRepository.permissions.push(buildPermission({ id: 'perm-1', code: 'users:show' }));
            userPermissionsRepository.userPermissionsMap.set('user-1', ['perm-1']);

            const result = await service.getPermissions('user-1');

            expect(result).toEqual(['users:show']);
            expect(cache.has('user-permissions:user-1')).toBe(true);
        });

        it('deve cair para o repositório (fail-open) quando o Redis falha na leitura', async () => {
            userPermissionsRepository.users.push(buildUser({ id: 'user-1' }));
            userPermissionsRepository.permissions.push(buildPermission({ id: 'perm-1', code: 'users:show' }));
            userPermissionsRepository.userPermissionsMap.set('user-1', ['perm-1']);
            cache.shouldThrowOnGet = true;

            await expect(service.getPermissions('user-1')).resolves.toEqual(['users:show']);
        });

        it('não deve lançar erro (fail-open) quando o Redis falha ao gravar no cache', async () => {
            userPermissionsRepository.users.push(buildUser({ id: 'user-1' }));
            userPermissionsRepository.permissions.push(buildPermission({ id: 'perm-1', code: 'users:show' }));
            userPermissionsRepository.userPermissionsMap.set('user-1', ['perm-1']);
            cache.shouldThrowOnSet = true;

            await expect(service.getPermissions('user-1')).resolves.toEqual(['users:show']);
        });
    });

    describe('[method]: #invalidatePermissions', () => {
        it('deve apagar a chave do usuário, forçando um cache miss na próxima consulta', async () => {
            cache.seed('user-permissions:user-1', JSON.stringify(['users:show']));

            await service.invalidatePermissions('user-1');

            expect(cache.has('user-permissions:user-1')).toBe(false);
        });

        it('não deve lançar erro (fail-open) quando o Redis falha ao apagar a chave', async () => {
            cache.shouldThrowOnDel = true;

            await expect(service.invalidatePermissions('user-1')).resolves.toBeUndefined();
        });
    });

    describe('[method]: #invalidatePermissionsByDepartment', () => {
        it('deve invalidar o cache de todos os usuários vinculados ao departamento', async () => {
            userDepartmentsRepository.userDepartmentsMap.set('user-1', ['dep-1']);
            userDepartmentsRepository.userDepartmentsMap.set('user-2', ['dep-1']);
            cache.seed('user-permissions:user-1', JSON.stringify(['x']));
            cache.seed('user-permissions:user-2', JSON.stringify(['x']));

            await service.invalidatePermissionsByDepartment('dep-1');

            expect(cache.has('user-permissions:user-1')).toBe(false);
            expect(cache.has('user-permissions:user-2')).toBe(false);
        });

        it('não deve invalidar o cache de usuários de outros departamentos', async () => {
            userDepartmentsRepository.userDepartmentsMap.set('user-1', ['dep-1']);
            userDepartmentsRepository.userDepartmentsMap.set('user-2', ['dep-2']);
            cache.seed('user-permissions:user-1', JSON.stringify(['x']));
            cache.seed('user-permissions:user-2', JSON.stringify(['x']));

            await service.invalidatePermissionsByDepartment('dep-1');

            expect(cache.has('user-permissions:user-1')).toBe(false);
            expect(cache.has('user-permissions:user-2')).toBe(true); // preservado
        });

        it('não deve lançar erro quando o departamento não tem nenhum usuário vinculado', async () => {
            await expect(service.invalidatePermissionsByDepartment('dep-vazio')).resolves.toBeUndefined();
        });

        it('🔒 deve invalidar TODOS os usuários mesmo quando excedem um único lote de batching (> 500)', async () => {
            const TOTAL_USERS = 501; // cruza o BATCH_SIZE (500) por uma unidade
            for (let i = 0; i < TOTAL_USERS; i++) {
                const userId = `user-${i}`;
                userDepartmentsRepository.userDepartmentsMap.set(userId, ['dep-1']);
                cache.seed(`user-permissions:${userId}`, JSON.stringify(['x']));
            }

            await service.invalidatePermissionsByDepartment('dep-1');

            expect(cache.has('user-permissions:user-0')).toBe(false); // primeiro lote
            expect(cache.has('user-permissions:user-499')).toBe(false); // fim do primeiro lote
            expect(cache.has('user-permissions:user-500')).toBe(false); // início do segundo lote
        });
    });

    describe('[method]: #invalidatePermissionsByPermission', () => {
        it('deve invalidar o cache de um usuário que tem a permissão concedida diretamente', async () => {
            userPermissionsRepository.userPermissionsMap.set('user-1', ['perm-1']);
            cache.seed('user-permissions:user-1', JSON.stringify(['x']));

            await service.invalidatePermissionsByPermission('perm-1');

            expect(cache.has('user-permissions:user-1')).toBe(false);
        });

        it('deve invalidar o cache de todos os usuários que herdam a permissão via departamento', async () => {
            userPermissionsRepository.departmentPermissionsMap.set('dep-1', ['perm-1']);
            userPermissionsRepository.userDepartmentsMap.set('user-1', ['dep-1']);
            userPermissionsRepository.userDepartmentsMap.set('user-2', ['dep-1']);
            cache.seed('user-permissions:user-1', JSON.stringify(['x']));
            cache.seed('user-permissions:user-2', JSON.stringify(['x']));

            await service.invalidatePermissionsByPermission('perm-1');

            expect(cache.has('user-permissions:user-1')).toBe(false);
            expect(cache.has('user-permissions:user-2')).toBe(false);
        });

        it('deve invalidar apenas uma vez quando o usuário tem a mesma permissão direta E herdada (sem duplicar a chamada)', async () => {
            userPermissionsRepository.userPermissionsMap.set('user-1', ['perm-1']);
            userPermissionsRepository.departmentPermissionsMap.set('dep-1', ['perm-1']);
            userPermissionsRepository.userDepartmentsMap.set('user-1', ['dep-1']);
            const spyInvalidate = vi.spyOn(service, 'invalidatePermissions');

            await service.invalidatePermissionsByPermission('perm-1');

            expect(spyInvalidate).toHaveBeenCalledTimes(1);
            expect(spyInvalidate).toHaveBeenCalledWith('user-1');
        });

        it('não deve invalidar o cache de usuários que não têm relação nenhuma com a permissão', async () => {
            userPermissionsRepository.userPermissionsMap.set('user-1', ['perm-1']);
            userPermissionsRepository.userPermissionsMap.set('user-2', ['perm-outra']);
            cache.seed('user-permissions:user-1', JSON.stringify(['x']));
            cache.seed('user-permissions:user-2', JSON.stringify(['x']));

            await service.invalidatePermissionsByPermission('perm-1');

            expect(cache.has('user-permissions:user-1')).toBe(false);
            expect(cache.has('user-permissions:user-2')).toBe(true); // preservado
        });

        it('não deve lançar erro quando nenhum usuário possui a permissão (direta ou herdada)', async () => {
            const spyInvalidate = vi.spyOn(service, 'invalidatePermissions');

            await expect(service.invalidatePermissionsByPermission('perm-sem-uso')).resolves.toBeUndefined();
            expect(spyInvalidate).not.toHaveBeenCalled();
        });
    });
});
