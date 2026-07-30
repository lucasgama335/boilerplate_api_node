import { IUserDepartmentsRepository } from '@/modules/departments/repositories/user-departments.repository';
import { IUserPermissionsRepository } from '@/modules/user-access/repositories/user-permissions.repository';

export interface IUserPermissionsProvider {
    getPermissions(userId: string): Promise<string[]>;
    invalidatePermissions(userId: string): Promise<void>;
    invalidatePermissionsForUsers(userIds: string[]): Promise<void>; // NOVO
    getAffectedUserIdsByDepartment(departmentId: string): Promise<string[]>; // NOVO
    getAffectedUserIdsByPermission(permissionId: string): Promise<string[]>; // NOVO
    invalidatePermissionsByDepartment(departmentId: string): Promise<void>; // mantido — usado no update()
    invalidatePermissionsByPermission(permissionId: string): Promise<void>; // mantido — usado no update
}

export interface IRedisCache {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: 'EX', seconds: number): Promise<'OK' | null>;
    del(key: string): Promise<number>;
}

export class UserPermissionsProvider implements IUserPermissionsProvider {
    private readonly CACHE_TTL_SECONDS = 300;
    private readonly BATCH_SIZE = 500;
    constructor(
        private readonly userPermissionsRepository: IUserPermissionsRepository,
        private readonly userDepartmentsRepository: IUserDepartmentsRepository,
        private readonly cache: IRedisCache,
    ) {}

    async getPermissions(userId: string): Promise<string[]> {
        const cacheKey = `user-permissions:${userId}`;

        // TENTA BUSCAR NO REDIS PRIMEIRO
        try {
            const cached = await this.cache.get(cacheKey);
            if (cached !== null) {
                return JSON.parse(cached) as string[];
            }
        } catch {
            // FAIL-OPEN: Redis fora do ar.
            // Ignoramos a exceção silenciosamente e deixamos o fluxo seguir para o banco.
        }

        // CACHE MISS (Ou Redis indisponível): Busca no Banco de Dados
        const permissions = await this.userPermissionsRepository.getPermissionsCode(userId);

        try {
            await this.cache.set(cacheKey, JSON.stringify(permissions), 'EX', this.CACHE_TTL_SECONDS);
        } catch {
            // FAIL-OPEN: Se o Redis não conseguir gravar, a requisição atual do usuário
            // não deve ser interrompida com um Erro 500. Segue o jogo!
        }

        return permissions;
    }

    async invalidatePermissions(userId: string): Promise<void> {
        const cacheKey = `user-permissions:${userId}`;

        try {
            await this.cache.del(cacheKey);
        } catch {
            // FAIL-OPEN: Se falhar ao apagar, o cache expirará naturalmente pelo TTL.
            // Isso evita que uma falha de infraestrutura quebre a lógica de revogação.
        }
    }

    async getAffectedUserIdsByDepartment(departmentId: string): Promise<string[]> {
        return this.userDepartmentsRepository.getDepartmentUsers(departmentId);
    }

    async getAffectedUserIdsByPermission(permissionId: string): Promise<string[]> {
        return this.userPermissionsRepository.getUserIdsByPermissionId(permissionId);
    }

    async invalidatePermissionsForUsers(userIds: string[]): Promise<void> {
        for (let i = 0; i < userIds.length; i += this.BATCH_SIZE) {
            const batch = userIds.slice(i, i + this.BATCH_SIZE);
            await Promise.all(batch.map((userId) => this.invalidatePermissions(userId)));
        }
    }

    async invalidatePermissionsByDepartment(departmentId: string): Promise<void> {
        const userIds = await this.getAffectedUserIdsByDepartment(departmentId);
        await this.invalidatePermissionsForUsers(userIds);
    }

    async invalidatePermissionsByPermission(permissionId: string): Promise<void> {
        const userIds = await this.getAffectedUserIdsByPermission(permissionId);
        await this.invalidatePermissionsForUsers(userIds);
    }
}
