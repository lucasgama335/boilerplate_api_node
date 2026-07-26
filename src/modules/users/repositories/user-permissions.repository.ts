import { DatabaseType } from '@/database';
import { permissions, permissionSourceEnum, userPermissions, users } from '@/database/schema';
import { and, eq } from 'drizzle-orm';

export interface IUserPermissionsRepository {
    getPermissionsByUserId(userId: string): Promise<string[]>;
    getPermissionsCode(userId: string): Promise<string[]>;
    setPermission(userId: string, permissionId: string, source: permissionSourceEnum, originDepartmentId?: string, grantedById?: string): Promise<void>;
    removePermission(userId: string, permissionId: string): Promise<void>;
    removePermissionsByDepartment(userId: string, departmentId: string): Promise<void>;
    removeAllPermissions(userId: string): Promise<void>;
}

export class DrizzleUserPermissionsRepository implements IUserPermissionsRepository {
    constructor(private readonly db: DatabaseType) {}

    async getPermissionsByUserId(userId: string): Promise<string[]> {
        const results = await this.db.select({ permissionId: userPermissions.permissionId }).from(userPermissions).where(eq(userPermissions.userId, userId));

        return results.map((bond) => bond.permissionId);
    }

    async getPermissionsCode(userId: string): Promise<string[]> {
        // Checagem rápida de Super Admin (só bate no banco quando o Cache expira!)
        const [user] = await this.db.select({ isSuperUser: users.isSuperUser }).from(users).where(eq(users.id, userId));
        if (user?.isSuperUser) {
            return ['*']; // Devolve o curinga absoluto!
        }

        // Se não for Super Admin, segue o fluxo normal do JOIN
        const result = await this.db
            .select({
                code: permissions.code,
            })
            .from(userPermissions)
            .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
            .where(
                and(
                    eq(userPermissions.userId, userId),
                    eq(permissions.isActive, true), // 🛡️ Regra de Ouro: ignoramos permissões inativas
                ),
            );

        // O select acima retorna um array de objetos:
        // [{ code: 'users:create' }, { code: 'reports:view' }]
        //
        // O map abaixo extrai apenas os valores, retornando um array de strings limpo:
        // ['users:create', 'reports:view']
        const permissionsList = result.map((row) => row.code);

        // o Set garante a remoção de permissões duplicadas
        return [...new Set(permissionsList)];
    }

    async setPermission(userId: string, permissionId: string, source: permissionSourceEnum, originDepartmentId?: string, grantedById?: string): Promise<void> {
        await this.db.insert(userPermissions).values({ userId, permissionId, source, originDepartmentId, grantedById }).onConflictDoNothing();
    }

    async removePermission(userId: string, permissionId: string): Promise<void> {
        const conditions = [eq(userPermissions.userId, userId), eq(userPermissions.permissionId, permissionId)];
        await this.db.delete(userPermissions).where(and(...conditions));
    }

    async removePermissionsByDepartment(userId: string, departmentId: string): Promise<void> {
        const conditions = [
            eq(userPermissions.userId, userId),
            eq(userPermissions.source, 'department'), // Garante que só afeta permissões herdadas
            eq(userPermissions.originDepartmentId, departmentId),
        ];
        await this.db.delete(userPermissions).where(and(...conditions));
    }

    async removeAllPermissions(userId: string): Promise<void> {
        await this.db.delete(userPermissions).where(eq(userPermissions.userId, userId));
    }
}
