import { CreatePermissionDTO, Permission, PermissionsFindMany, UpdatePermissionDTO } from '../../types/permissions.types';

export interface IInMemoryPermissionsRepository {
    findMany(page: number, limit: number): Promise<PermissionsFindMany>;
    findById(id: string): Promise<Permission | null>;
    findByCode(code: string): Promise<Permission | null>;
    create(data: CreatePermissionDTO): Promise<Permission>;
    update(id: string, data: UpdatePermissionDTO): Promise<Permission | null>;
    delete(id: string): Promise<void>;
}

export class InMemoryPermissionsRepository implements IInMemoryPermissionsRepository {
    private items: Permission[] = [];

    async findMany(page: number, limit: number): Promise<PermissionsFindMany> {
        const offset = (page - 1) * limit;

        // Aplica a paginação (Offset e Limit) usando o .slice()
        const paginatedItems = this.items.slice(offset, offset + limit);

        const total = this.items.length;

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
        const permission = this.items.find((item) => item.id === id);
        if (permission) {
            Object.assign(permission, {
                ...data,
                updatedAt: new Date(),
            });
            return permission;
        }
        return null;
    }

    async delete(id: string): Promise<void> {
        this.items = this.items.filter((item) => item.id !== id);
    }
}
