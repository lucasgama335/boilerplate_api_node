import { DatabaseType } from '@/database';
import { departmentPermissions, departments, permissions } from '@/database/schema';
import { Permission } from '@/modules/permissions/types/permissions.types';
import { count, desc, eq, inArray } from 'drizzle-orm';
import { CreateDepartmentDTO, Department, DepartmentsFindManyResponse, DepartmentWithPermissions, UpdateDepartmentDTO } from '../types/departments.types';

export interface IDepartmentsRepository {
    findByName(name: string): Promise<Department | null>;

    findById(id: string, withPermissions: true): Promise<DepartmentWithPermissions | null>;
    findById(id: string, withPermissions?: false): Promise<Department | null>;
    findById(id: string, withPermissions?: boolean): Promise<Department | DepartmentWithPermissions | null>;

    findMany(page: number, limit: number, withPermissions: true): Promise<DepartmentsFindManyResponse<true>>;
    findMany(page: number, limit: number, withPermissions?: false): Promise<DepartmentsFindManyResponse<false>>;
    findMany(page: number, limit: number, withPermissions?: boolean): Promise<DepartmentsFindManyResponse<true> | DepartmentsFindManyResponse<false>>;

    checkPermissionsExist(ids: string[]): Promise<boolean>;

    create(data: CreateDepartmentDTO): Promise<DepartmentWithPermissions>;
    update(id: string, data: UpdateDepartmentDTO): Promise<DepartmentWithPermissions>;
    delete(id: string): Promise<void>;
}

export class DrizzleDepartmentsRepository implements IDepartmentsRepository {
    constructor(private readonly db: DatabaseType) {}

    async findByName(name: string): Promise<Department | null> {
        const [result] = await this.db.select().from(departments).where(eq(departments.name, name));
        return result || null;
    }

    async findById(id: string, withPermissions: true): Promise<DepartmentWithPermissions | null>;
    async findById(id: string, withPermissions?: false): Promise<Department | null>;
    async findById(id: string, withPermissions: boolean = false): Promise<Department | DepartmentWithPermissions | null> {
        const [department] = await this.db.select().from(departments).where(eq(departments.id, id));
        if (!department) {
            return null;
        }

        if (!withPermissions) {
            return department;
        }

        const departmentPerms = await this.db
            .select({
                permission: permissions,
            })
            .from(departmentPermissions)
            .innerJoin(permissions, eq(departmentPermissions.permissionId, permissions.id))
            .where(eq(departmentPermissions.departmentId, id));

        return {
            ...department,
            permissions: departmentPerms.map((p) => p.permission),
        };
    }

    async findMany(page: number, limit: number, withPermissions: true): Promise<DepartmentsFindManyResponse<true>>;
    async findMany(page: number, limit: number, withPermissions?: false): Promise<DepartmentsFindManyResponse<false>>;
    async findMany<T extends boolean>(page: number, limit: number, withPermissions?: T): Promise<DepartmentsFindManyResponse<T>> {
        const offset = (page - 1) * limit;
        const isWithPermissions = Boolean(withPermissions);

        const [countResult, items] = await Promise.all([
            this.db.select({ count: count() }).from(departments),
            this.db.select().from(departments).orderBy(desc(departments.createdAt)).limit(limit).offset(offset),
        ]);

        const total = Number(countResult[0]?.count ?? 0);

        if (!isWithPermissions || items.length === 0) {
            return {
                departments: items,
                total,
            } as unknown as DepartmentsFindManyResponse<T>;
        }

        const departmentIds = items.map((dep) => dep.id);

        const allRelations = await this.db
            .select({
                departmentId: departmentPermissions.departmentId,
                permission: permissions,
            })
            .from(departmentPermissions)
            .innerJoin(permissions, eq(departmentPermissions.permissionId, permissions.id))
            .where(inArray(departmentPermissions.departmentId, departmentIds));

        const permissionsMap = new Map<string, Permission[]>();
        for (const relation of allRelations) {
            const list = permissionsMap.get(relation.departmentId) || [];
            list.push(relation.permission);
            permissionsMap.set(relation.departmentId, list);
        }

        const departmentsWithPermissions: DepartmentWithPermissions[] = items.map((dep) => ({
            ...dep,
            permissions: permissionsMap.get(dep.id) || [],
        }));

        return {
            departments: departmentsWithPermissions,
            total,
        } as unknown as DepartmentsFindManyResponse<T>;
    }

    async checkPermissionsExist(ids: string[]): Promise<boolean> {
        if (!ids || ids.length === 0) {
            return true;
        }

        const found = await this.db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.id, ids));

        return found.length === ids.length;
    }

    async create(data: CreateDepartmentDTO): Promise<DepartmentWithPermissions> {
        const { permissions: permissionIds, ...departmentData } = data;

        return await this.db.transaction(async (tx) => {
            const [department] = await tx.insert(departments).values(departmentData).returning();

            let associatedPermissions: Permission[] = [];

            if (permissionIds && permissionIds.length > 0) {
                const relationsToInsert = permissionIds.map((permissionId) => ({
                    departmentId: department.id,
                    permissionId,
                }));

                await tx.insert(departmentPermissions).values(relationsToInsert);

                associatedPermissions = await tx.select().from(permissions).where(inArray(permissions.id, permissionIds));
            }

            return {
                ...department,
                permissions: associatedPermissions,
            };
        });
    }

    async update(id: string, data: UpdateDepartmentDTO): Promise<DepartmentWithPermissions> {
        const { permissions: permissionIds, ...departmentData } = data;

        return await this.db.transaction(async (tx) => {
            let department: Department;

            if (Object.keys(departmentData).length > 0) {
                const [updated] = await tx
                    .update(departments)
                    .set({ ...departmentData, updatedAt: new Date() })
                    .where(eq(departments.id, id))
                    .returning();
                department = updated;
            } else {
                const [found] = await tx.select().from(departments).where(eq(departments.id, id));
                department = found;
            }

            if (permissionIds) {
                await tx.delete(departmentPermissions).where(eq(departmentPermissions.departmentId, id));

                if (permissionIds.length > 0) {
                    const relationsToInsert = permissionIds.map((permissionId) => ({
                        departmentId: id,
                        permissionId,
                    }));
                    await tx.insert(departmentPermissions).values(relationsToInsert);
                }
            }

            const departmentPerms = await tx
                .select({
                    permission: permissions,
                })
                .from(departmentPermissions)
                .innerJoin(permissions, eq(departmentPermissions.permissionId, permissions.id))
                .where(eq(departmentPermissions.departmentId, id));

            return {
                ...department,
                permissions: departmentPerms.map((p) => p.permission),
            };
        });
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(departments).where(eq(departments.id, id));
    }
}
