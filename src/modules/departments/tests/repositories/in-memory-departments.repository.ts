import { Permission } from '@/modules/permissions/types/permissions.types';
import { IDepartmentsRepository } from '../../repositories/departments.repository';
import { CreateDepartmentDTO, Department, DepartmentsFilters, DepartmentsFindManyResponse, DepartmentWithPermissions, UpdateDepartmentDTO } from '../../types/departments.types';

export class InMemoryDepartmentsRepository implements IDepartmentsRepository {
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

    async findMany(page: number, limit: number, withPermissions: true, filters?: DepartmentsFilters): Promise<DepartmentsFindManyResponse<true>>;
    async findMany(page: number, limit: number, withPermissions?: false, filters?: DepartmentsFilters): Promise<DepartmentsFindManyResponse<false>>;
    async findMany<T extends boolean>(page: number, limit: number, withPermissions?: T, filters?: DepartmentsFilters): Promise<DepartmentsFindManyResponse<T>> {
        // APLICAR FILTROS ANTES DA PAGINAÇÃO
        let filteredItems = [...this.items];

        if (filters?.name) {
            const searchName = filters.name.toLowerCase();
            filteredItems = filteredItems.filter(
                (item) => item.name.toLowerCase().includes(searchName), // Simulando o ILIKE do Postgres
            );
        }

        if (filters?.startDate) {
            filteredItems = filteredItems.filter((item) => item.createdAt >= filters.startDate!);
        }

        if (filters?.endDate) {
            filteredItems = filteredItems.filter((item) => item.createdAt <= filters.endDate!);
        }

        // O total deve ser a quantidade de itens encontrados no filtro, não o total geral da tabela
        const total = filteredItems.length;

        // PAGINAÇÃO E ORDENAÇÃO
        const start = (page - 1) * limit;
        const end = start + limit;

        // Espelhando o comportamento do Drizzle (ordenado do mais recente para o mais antigo)
        const sortedItems = filteredItems.reverse();
        const paginatedItems = sortedItems.slice(start, end);

        const isWithPermissions = Boolean(withPermissions);

        if (!isWithPermissions || paginatedItems.length === 0) {
            return {
                departments: paginatedItems,
                total,
            } as unknown as DepartmentsFindManyResponse<T>;
        }

        // MAPEAMENTO DE PERMISSÕES
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
