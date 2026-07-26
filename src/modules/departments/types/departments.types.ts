import { departments } from '@/database/schema';
import { Permission } from '../../permissions/types/permissions.types';

type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
export type Department = typeof departments.$inferSelect;
export type CreateDepartmentDTO = Prettify<
    Partial<Pick<Department, 'description' | 'createdById' | 'isActive'>> &
        Pick<Department, 'name'> & {
            permissions?: string[];
        }
>;
export type UpdateDepartmentDTO = Prettify<
    Partial<Pick<Department, 'name' | 'description' | 'isActive' | 'createdById' | 'updatedById'>> & {
        permissions?: string[];
    }
>;

export type DepartmentWithPermissions = Department & {
    permissions: Permission[] | null;
};
export type DepartmentsFindManyResponse<T extends boolean> = {
    departments: T extends true ? DepartmentWithPermissions[] : Department[];
    total: number;
};
