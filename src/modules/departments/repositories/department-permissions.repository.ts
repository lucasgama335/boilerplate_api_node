import { DatabaseType } from '@/database';
import { departmentPermissions } from '@/database/schema';
import { and, eq } from 'drizzle-orm';

export interface IDepartmentPermissionsRepository {
    getPermissionsByDepartmentId(departmentId: string): Promise<string[]>;
    setPermission(departmentId: string, permissionId: string): Promise<void>;
    removePermission(departmentId: string, permissionId: string): Promise<void>;
    removeAllPermissions(departmentId: string): Promise<void>;
}

export class DrizzleDepartmentPermissionsRepository implements IDepartmentPermissionsRepository {
    constructor(private readonly db: DatabaseType) {}

    async getPermissionsByDepartmentId(departmentId: string): Promise<string[]> {
        const results = await this.db
            .select({ permissionId: departmentPermissions.permissionId })
            .from(departmentPermissions)
            .where(eq(departmentPermissions.departmentId, departmentId));

        return results.map((bond) => bond.permissionId);
    }

    async setPermission(departmentId: string, permissionId: string): Promise<void> {
        await this.db.insert(departmentPermissions).values({ departmentId, permissionId }).onConflictDoNothing();
    }

    async removePermission(departmentId: string, permissionId: string): Promise<void> {
        const conditions = [eq(departmentPermissions.departmentId, departmentId), eq(departmentPermissions.permissionId, permissionId)];
        await this.db.delete(departmentPermissions).where(and(...conditions));
    }

    async removeAllPermissions(departmentId: string): Promise<void> {
        await this.db.delete(departmentPermissions).where(eq(departmentPermissions.departmentId, departmentId));
    }
}
