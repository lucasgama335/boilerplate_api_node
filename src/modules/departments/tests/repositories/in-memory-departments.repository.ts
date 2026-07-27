import { Permission } from '@/modules/permissions/types/permissions.types';
import { CreateDepartmentDTO, Department, DepartmentsFindManyResponse, DepartmentWithPermissions, UpdateDepartmentDTO } from '../../types/departments.types';

export interface IInMemoryDepartmentsRepository {
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

export class InMemoryDepartmentsRepository implements IInMemoryDepartmentsRepository {
    public items: Department[] = [];
    public departmentPermissionsMap: Map<string, Permission[]> = new Map();
    public validPermissionIds: Set<string> = new Set();

    async findByName(name: string): Promise<Department | null> {
        const department = this.items.find((item) => item.name.toLowerCase() === name.toLowerCase());
        return department ?? null;
    }

    async findById(id: string, withPermissions: true): Promise<DepartmentWithPermissions | null>;
    async findById(id: string, withPermissions?: false): Promise<Department | null>;
    async findById(id: string, withPermissions: boolean = false): Promise<Department | DepartmentWithPermissions | null> {
        const department = this.items.find((item) => item.id === id);
        if (!department) {
            return null;
        }

        if (!withPermissions) {
            return department;
        }

        const permissions = this.departmentPermissionsMap.get(id) || [];
        return {
            ...department,
            permissions,
        };
    }

    async findMany(page: number, limit: number, withPermissions: true): Promise<DepartmentsFindManyResponse<true>>;
    async findMany(page: number, limit: number, withPermissions?: false): Promise<DepartmentsFindManyResponse<false>>;
    async findMany<T extends boolean>(page: number, limit: number, withPermissions?: T): Promise<DepartmentsFindManyResponse<T>> {
        const total = this.items.length;
        const start = (page - 1) * limit;
        const end = start + limit;

        // Espelhando o comportamento do Drizzle (ordenado do mais recente para o mais antigo)
        const sortedItems = [...this.items].reverse();
        const paginatedItems = sortedItems.slice(start, end);

        const isWithPermissions = Boolean(withPermissions);

        if (!isWithPermissions || paginatedItems.length === 0) {
            return {
                departments: paginatedItems,
                total,
            } as unknown as DepartmentsFindManyResponse<T>;
        }

        const departmentsWithPermissions: DepartmentWithPermissions[] = paginatedItems.map((dep) => ({
            ...dep,
            permissions: this.departmentPermissionsMap.get(dep.id) || [],
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
        return ids.every((id) => this.validPermissionIds.has(id));
    }

    async create(data: CreateDepartmentDTO): Promise<DepartmentWithPermissions> {
        const { permissions: permissionIds, ...departmentData } = data;

        const department: Department = {
            id: crypto.randomUUID(),
            name: departmentData.name,
            description: departmentData.description ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: crypto.randomUUID(),
            updatedById: '',
        };

        this.items.push(department);

        let associatedPermissions: Permission[] = [];
        if (permissionIds && permissionIds.length > 0) {
            associatedPermissions = permissionIds.map((id) => ({
                id,
                code: `permission:${id}`,
                description: `Permission description ${id}`,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));
            this.departmentPermissionsMap.set(department.id, associatedPermissions);
        }

        return {
            ...department,
            permissions: associatedPermissions,
        };
    }

    async update(id: string, data: UpdateDepartmentDTO): Promise<DepartmentWithPermissions> {
        const index = this.items.findIndex((item) => item.id === id);
        const existingDepartment = this.items[index];

        const { permissions: permissionIds, ...departmentData } = data;

        const updatedDepartment: Department = {
            ...existingDepartment,
            ...departmentData,
            updatedAt: new Date(),
        };

        this.items[index] = updatedDepartment;

        if (permissionIds !== undefined) {
            if (permissionIds.length > 0) {
                const associatedPermissions: Permission[] = permissionIds.map((permId) => ({
                    id: permId,
                    code: `permission:${permId}`,
                    description: `Permission description ${permId}`,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }));
                this.departmentPermissionsMap.set(id, associatedPermissions);
            } else {
                this.departmentPermissionsMap.set(id, []);
            }
        }

        const permissions = this.departmentPermissionsMap.get(id) || [];

        return {
            ...updatedDepartment,
            permissions,
        };
    }

    async delete(id: string): Promise<void> {
        const index = this.items.findIndex((item) => item.id === id);
        if (index >= 0) {
            this.items.splice(index, 1);
            this.departmentPermissionsMap.delete(id);
        }
    }
}
