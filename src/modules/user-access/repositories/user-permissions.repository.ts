import { DatabaseType, TransactionClient } from '@/database';
import { departmentPermissions, permissions, userDeniedPermissions, userDepartments, userPermissions, users } from '@/database/schema';
import { Permission } from '@/modules/permissions/types/permissions.types';
import { UserWithPermissions } from '@/modules/users/types/users.types';
import { and, eq, getTableColumns, inArray } from 'drizzle-orm';
import { union } from 'drizzle-orm/pg-core';

export interface IUserPermissionsRepository {
    checkPermissionsExist(ids: string[]): Promise<boolean>;
    getPermissionsByUserId(userId: string, tx?: TransactionClient): Promise<Permission[]>;
    getPermissionsCode(userId: string): Promise<string[]>;
    getUserIdsByPermissionId(permissionId: string): Promise<string[]>;
    setPermissions(userId: string, permissions: string[], grantedById?: string): Promise<UserWithPermissions>;
    removePermission(userId: string, permissionId: string): Promise<void>;
    removeAllPermissions(userId: string): Promise<void>;
}

export class DrizzleUserPermissionsRepository implements IUserPermissionsRepository {
    constructor(private readonly db: DatabaseType) {}

    async checkPermissionsExist(ids: string[]): Promise<boolean> {
        if (!ids || ids.length === 0) {
            return true;
        }

        const found = await this.db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.id, ids));

        return found.length === ids.length;
    }

    async getPermissionsByUserId(userId: string, tx?: TransactionClient): Promise<Permission[]> {
        const executor = tx || this.db;

        const [user] = await executor.select({ isSuperUser: users.isSuperUser }).from(users).where(eq(users.id, userId));

        if (user?.isSuperUser) {
            return await executor.select().from(permissions);
        }

        const permissionsColumns = getTableColumns(permissions);
        const manualPerms = executor
            .select(permissionsColumns)
            .from(userPermissions)
            .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
            .where(eq(userPermissions.userId, userId));
        const depPerms = executor
            .select(permissionsColumns)
            .from(userDepartments)
            .innerJoin(departmentPermissions, eq(userDepartments.departmentId, departmentPermissions.departmentId))
            .innerJoin(permissions, eq(departmentPermissions.permissionId, permissions.id))
            .where(eq(userDepartments.userId, userId));

        const allowedPermissions = await union(manualPerms, depPerms);

        const deniedResults = await executor.select({ id: userDeniedPermissions.permissionId }).from(userDeniedPermissions).where(eq(userDeniedPermissions.userId, userId));
        const deniedSet = new Set(deniedResults.map((row) => row.id));

        const finalPermissions = allowedPermissions.filter((perm) => !deniedSet.has(perm.id));

        return finalPermissions;
    }

    async getPermissionsCode(userId: string): Promise<string[]> {
        // 1. Verifica se o usuário é Super Admin antes de cruzar tabelas
        const [user] = await this.db.select({ isSuperUser: users.isSuperUser }).from(users).where(eq(users.id, userId));
        if (user?.isSuperUser) {
            return ['*'];
        }

        // 2. Códigos concedidos manualmente
        const manualCodes = this.db
            .select({ code: permissions.code })
            .from(userPermissions)
            .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
            .where(eq(userPermissions.userId, userId));

        // 3. Códigos herdados de departamentos
        const depCodes = this.db
            .select({ code: permissions.code })
            .from(userDepartments)
            .innerJoin(departmentPermissions, eq(userDepartments.departmentId, departmentPermissions.departmentId))
            .innerJoin(permissions, eq(departmentPermissions.permissionId, permissions.id))
            .where(eq(userDepartments.userId, userId));

        // 4. Executa a união (A + B) das permissões permitidas
        const allowedResults = await union(manualCodes, depCodes);
        const allowedCodes = allowedResults.map((row) => row.code);

        // 5. Busca as Negações Explícitas
        const deniedResults = await this.db
            .select({ code: permissions.code })
            .from(userDeniedPermissions)
            .innerJoin(permissions, eq(userDeniedPermissions.permissionId, permissions.id))
            .where(eq(userDeniedPermissions.userId, userId));

        // Transforma a lista de negados em um "Set" (O(1) na busca)
        const deniedSet = new Set(deniedResults.map((row) => row.code));

        // Filtra a lista final mantendo apenas o que NÃO ESTÁ no Set de bloqueados
        const finalCodes = allowedCodes.filter((code) => !deniedSet.has(code));

        return finalCodes;
    }

    async getUserIdsByPermissionId(permissionId: string): Promise<string[]> {
        // Usuários que têm a permissão concedida diretamente
        const directUserIds = this.db.select({ userId: userPermissions.userId }).from(userPermissions).where(eq(userPermissions.permissionId, permissionId));

        // Usuários que herdam a permissão via departamento
        const inheritedUserIds = this.db
            .select({ userId: userDepartments.userId })
            .from(departmentPermissions)
            .innerJoin(userDepartments, eq(departmentPermissions.departmentId, userDepartments.departmentId))
            .where(eq(departmentPermissions.permissionId, permissionId));

        // UNION já remove duplicatas (mesmo padrão usado em getPermissionsCode)
        const results = await union(directUserIds, inheritedUserIds);

        return results.map((row) => row.userId);
    }

    async setPermissions(userId: string, permissionsIds: string[], grantedById?: string): Promise<UserWithPermissions> {
        return await this.db.transaction(async (tx) => {
            // 1. Remove as permissões anteriores do usuário
            await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));

            // 2. Insere as novas permissões se houverem
            if (permissionsIds.length > 0) {
                const relationsToInsert = permissionsIds.map((permissionId) => ({
                    permissionId,
                    userId,
                    grantedById: grantedById ?? null,
                }));

                await tx.insert(userPermissions).values(relationsToInsert);
            }

            // 3. Busca as informações do usuário
            const [user] = await tx.select().from(users).where(eq(users.id, userId));

            // 4. Busca as permissões usando o 'tx' para enxergar o que acabou de ser inserido
            const userPerms = await this.getPermissionsByUserId(userId, tx);

            return { ...user, permissions: userPerms };
        });
    }

    async removePermission(userId: string, permissionId: string): Promise<void> {
        const conditions = [eq(userPermissions.userId, userId), eq(userPermissions.permissionId, permissionId)];
        await this.db.delete(userPermissions).where(and(...conditions));
    }

    async removeAllPermissions(userId: string): Promise<void> {
        await this.db.delete(userPermissions).where(eq(userPermissions.userId, userId));
    }
}
