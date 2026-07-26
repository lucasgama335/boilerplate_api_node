import { permissions } from '@/database/schema';

// ==========================================
// PERMISSIONS
// ==========================================
export type Permission = typeof permissions.$inferSelect;
export type CreatePermissionDTO = typeof permissions.$inferInsert;
export type UpdatePermissionDTO = Partial<Pick<Permission, 'code' | 'description' | 'isActive'>>;

export type PermissionsFindMany = { permissions: Permission[]; total: number };
export type PaginatedPermissionsResponse = {
    permissions: Permission[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};
