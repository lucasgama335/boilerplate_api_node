import { DatabaseType, TransactionClient } from '@/database';
import { permissions, userDeniedPermissions } from '@/database/schema';
import { Permission } from '@/modules/permissions/types/permissions.types';
import { and, eq, getTableColumns, inArray } from 'drizzle-orm';

export interface IUserDeniedPermissionsRepository {
    checkPermissionsExist(ids: string[]): Promise<boolean>;
    getRawDeniedPermissions(userId: string, tx?: TransactionClient): Promise<Permission[]>;
    setDeniedPermissions(userId: string, permissions: string[], grantedById?: string): Promise<void>;
    removeBlockedPermission(userId: string, permissionId: string): Promise<void>;
    removeAllBlockedPermissions(userId: string): Promise<void>;
}

export class DrizzleUserDeniedPermissionsRepository implements IUserDeniedPermissionsRepository {
    constructor(private readonly db: DatabaseType) {}

    async checkPermissionsExist(ids: string[]): Promise<boolean> {
        if (!ids || ids.length === 0) {
            return true;
        }

        const found = await this.db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.id, ids));

        return found.length === ids.length;
    }

    async getRawDeniedPermissions(userId: string): Promise<Permission[]> {
        const permissionColumns = getTableColumns(permissions);
        return await this.db
            .select(permissionColumns)
            .from(userDeniedPermissions)
            .innerJoin(permissions, eq(userDeniedPermissions.permissionId, permissions.id))
            .where(eq(userDeniedPermissions.userId, userId));
    }

    async setDeniedPermissions(userId: string, permissionsIds: string[], deniedById?: string): Promise<void> {
        return await this.db.transaction(async (tx) => {
            // 1. Remove as permissões anteriores do usuário
            await tx.delete(userDeniedPermissions).where(eq(userDeniedPermissions.userId, userId));

            // 2. Insere as novas permissões se houverem
            if (permissionsIds.length > 0) {
                const relationsToInsert = permissionsIds.map((permissionId) => ({
                    permissionId,
                    userId,
                    deniedById: deniedById ?? null,
                }));

                await tx.insert(userDeniedPermissions).values(relationsToInsert);
            }
        });
    }

    async removeBlockedPermission(userId: string, permissionId: string): Promise<void> {
        const conditions = [eq(userDeniedPermissions.userId, userId), eq(userDeniedPermissions.permissionId, permissionId)];
        await this.db.delete(userDeniedPermissions).where(and(...conditions));
    }

    async removeAllBlockedPermissions(userId: string): Promise<void> {
        await this.db.delete(userDeniedPermissions).where(eq(userDeniedPermissions.userId, userId));
    }
}
