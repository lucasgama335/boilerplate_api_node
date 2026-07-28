import { DatabaseType } from '@/database';
import { permissions } from '@/database/schema';
import { and, count, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import { CreatePermissionDTO, Permission, PermissionsFilters, PermissionsFindMany, UpdatePermissionDTO } from '../types/permissions.types';

export interface IPermissionsRepository {
    findMany(page: number, limit: number, filters?: PermissionsFilters): Promise<PermissionsFindMany>;
    findById(id: string): Promise<Permission | null>;
    findByCode(code: string): Promise<Permission | null>;
    create(data: CreatePermissionDTO): Promise<Permission>;
    update(id: string, data: UpdatePermissionDTO): Promise<Permission | null>;
    delete(id: string): Promise<void>;
}

export class DrizzlePermissionsRepository implements IPermissionsRepository {
    constructor(private readonly db: DatabaseType) {}

    async findMany(page: number, limit: number, filters?: PermissionsFilters): Promise<PermissionsFindMany> {
        const offset = (page - 1) * limit;

        // CONSTRÓI AS CONDIÇÕES DINAMICAMENTE
        const conditions = [];

        if (filters?.code) {
            // ilike faz a busca ignorando maiúsculas/minúsculas (ex: %Vendas%)
            conditions.push(ilike(permissions.code, `%${filters.code}%`));
        }
        if (filters?.startDate) {
            conditions.push(gte(permissions.createdAt, filters.startDate));
        }
        if (filters?.endDate) {
            // Se quiser que pegue até o final do dia: lte(departments.createdAt, dataNoFinalDoDia)
            conditions.push(lte(permissions.createdAt, filters.endDate));
        }

        // Se houver condições, junta com AND. Se não, fica undefined (sem WHERE).
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // 🛡️ Otimização: Executa o count e a busca de itens em paralelo no banco
        const [countResult, items] = await Promise.all([
            this.db.select({ count: count() }).from(permissions).where(whereClause),
            this.db.select().from(permissions).where(whereClause).orderBy(desc(permissions.createdAt)).limit(limit).offset(offset),
        ]);

        const total = Number(countResult[0]?.count ?? 0);

        return {
            permissions: items,
            total,
        };
    }

    async findById(id: string): Promise<Permission | null> {
        const [result] = await this.db.select().from(permissions).where(eq(permissions.id, id));
        return result || null;
    }

    async findByCode(code: string): Promise<Permission | null> {
        const [result] = await this.db.select().from(permissions).where(eq(permissions.code, code));
        return result || null;
    }

    async create(data: CreatePermissionDTO): Promise<Permission> {
        const [result] = await this.db.insert(permissions).values(data).returning();
        return result;
    }

    async update(id: string, data: UpdatePermissionDTO): Promise<Permission | null> {
        const [result] = await this.db
            .update(permissions)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(permissions.id, id))
            .returning();
        return result || null;
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(permissions).where(eq(permissions.id, id));
    }
}
