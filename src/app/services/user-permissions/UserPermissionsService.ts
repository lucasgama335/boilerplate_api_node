import { IUserDepartmentsRepository } from '@/modules/departments/repositories/user-departments.repository';
import { IUserPermissionsRepository } from '@/modules/user-access/repositories/user-permissions.repository';

export interface IUserPermissionsService {
    // Busca a lista de permissões. Se não estiver no Redis,
    // vai no banco (AuthorizationRepository), salva no Redis e devolve.
    getPermissions(userId: string): Promise<string[]>;

    // Apaga a chave do usuário no Redis para forçar
    // uma nova ida ao banco na próxima requisição.
    invalidatePermissionsByDepartment(departmentId: string): Promise<void>;
    invalidatePermissionsByPermission(permissionId: string): Promise<void>;
    invalidatePermissions(userId: string): Promise<void>;
}

export interface IRedisCache {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: 'EX', seconds: number): Promise<'OK' | null>;
    del(key: string): Promise<number>;
}

export class UserPermissionsService implements IUserPermissionsService {
    private readonly CACHE_TTL_SECONDS = 300;

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

    async invalidatePermissionsByDepartment(departmentId: string): Promise<void> {
        const usersTemps = await this.userDepartmentsRepository.getDepartmentUsers(departmentId);
        await Promise.all(usersTemps.map((userId) => this.invalidatePermissions(userId)));
    }

    async invalidatePermissionsByPermission(permissionId: string): Promise<void> {
        const affectedUserIds = await this.userPermissionsRepository.getUserIdsByPermissionId(permissionId);
        await Promise.all(affectedUserIds.map((userId) => this.invalidatePermissions(userId)));
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
}
