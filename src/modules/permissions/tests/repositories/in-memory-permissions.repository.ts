import { IPermissionsRepository } from '../../repositories/permissions.repository';
import { CreatePermissionDTO, Permission, PermissionsFilters, PermissionsFindMany, UpdatePermissionDTO } from '../../types/permissions.types';

export class InMemoryPermissionsRepository implements IPermissionsRepository {
    private items: Permission[] = [];

    async findMany(page: number, limit: number, filters?: PermissionsFilters): Promise<PermissionsFindMany> {
        // APLICAR FILTROS ANTES DA PAGINAÇÃO
        let filteredItems = [...this.items];

        if (filters?.code) {
            const searchCode = filters.code.toLowerCase();
            filteredItems = filteredItems.filter((item) => item.code.toLowerCase().includes(searchCode));
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
        const offset = (page - 1) * limit;

        // Aplica a paginação (Offset e Limit) usando o .slice()
        const paginatedItems = filteredItems.slice(offset, offset + limit);

        return {
            permissions: paginatedItems,
            total,
        };
    }

    async findById(id: string): Promise<Permission | null> {
        return this.items.find((item) => item.id == id) || null;
    }

    async findByCode(code: string): Promise<Permission | null> {
        return this.items.find((item) => item.code === code) || null;
    }

    async create(data: CreatePermissionDTO): Promise<Permission> {
        const permission: Permission = {
            id: data.id || crypto.randomUUID(),
            createdAt: data.createdAt || new Date(),
            updatedAt: data.createdAt || new Date(),
            ...data,
        };

        this.items.push(permission);
        return permission;
    }

    async update(id: string, data: UpdatePermissionDTO): Promise<Permission | null> {
        const index = this.items.findIndex((item) => item.id === id);
        if (index === -1) return null;

        const updated: Permission = { ...this.items[index], ...data, updatedAt: new Date() };
        this.items[index] = updated;
        return updated;
    }

    async delete(id: string): Promise<void> {
        this.items = this.items.filter((item) => item.id !== id);
    }
}
