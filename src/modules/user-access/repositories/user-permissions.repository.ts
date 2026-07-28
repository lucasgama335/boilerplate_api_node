import { DatabaseType } from '@/database';
import { departmentPermissions, permissions, userDepartments, userPermissions, users } from '@/database/schema';
import { UserWithPermissions } from '@/modules/users/types/users.types';
import { and, eq, inArray } from 'drizzle-orm';
import { union } from 'drizzle-orm/pg-core';

export interface IUserPermissionsRepository {
    checkPermissionsExist(ids: string[]): Promise<boolean>;
    getPermissionsByUserId(userId: string): Promise<string[]>;
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

    async getPermissionsByUserId(userId: string): Promise<string[]> {
        const results = await this.db.select({ permissionId: userPermissions.permissionId }).from(userPermissions).where(eq(userPermissions.userId, userId));

        return results.map((bond) => bond.permissionId);
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

        // 4. Executa a união e mapeia para array de strings
        const results = await union(manualCodes, depCodes);

        return results.map((row) => row.code);
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

            // 3. Busca e retorna os objetos completos de permissão vinculados ao usuário
            const userPerms = await tx
                .select({
                    permission: permissions,
                })
                .from(userPermissions)
                .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
                .where(eq(userPermissions.userId, userId));

            return { ...user, permissions: userPerms.map((p) => p.permission) };
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
