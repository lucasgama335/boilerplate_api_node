import { DatabaseType } from '@/database';
import { departmentPermissions, departments, permissions, userDepartments, userPermissions, users } from '@/database/schema';
import { Department } from '@/modules/departments/types/departments.types';
import { eq, getTableColumns, inArray } from 'drizzle-orm';
import { union } from 'drizzle-orm/pg-core';
import { CreateUserDTO, User, UserWithDepartmentsAndPermissions } from '../types/users.types';

export interface IUsersRepository {
    checkDepartmentsExist(ids: string[]): Promise<boolean>;

    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    findByIdWithDetails(userId: string): Promise<UserWithDepartmentsAndPermissions | null>;

    create(data: CreateUserDTO, grantedById?: string): Promise<UserWithDepartmentsAndPermissions>;

    isUserSuperAdmin(userId: string): Promise<boolean>;

    getTokensRevokedAt(userId: string): Promise<Date | null>;
    setTokensRevokedAt(userId: string, now: Date): Promise<void>;

    updatePassword(userId: string, newPassword: string, isEmailConfirmed?: boolean): Promise<User>;
    updateLastLogin(userId: string, date: Date): Promise<void>;
    confirmEmail(userId: string): Promise<void>;
}

export class DrizzleUsersRepository implements IUsersRepository {
    constructor(private readonly db: DatabaseType) {}

    async checkDepartmentsExist(ids: string[]): Promise<boolean> {
        if (!ids || ids.length === 0) {
            return true;
        }

        const found = await this.db.select({ id: departments.id }).from(departments).where(inArray(departments.id, ids));

        return found.length === ids.length;
    }

    async findByEmail(email: string): Promise<User | null> {
        const [result] = await this.db.select().from(users).where(eq(users.email, email));
        return result || null;
    }

    async findById(id: string): Promise<User | null> {
        const [result] = await this.db.select().from(users).where(eq(users.id, id));
        return result || null;
    }

    async findByIdWithDetails(userId: string): Promise<UserWithDepartmentsAndPermissions | null> {
        const [user] = await this.db.select().from(users).where(eq(users.id, userId));
        if (!user) return null;

        // Busca departamentos e permissões concorrentemente (Performance)
        const [userDeps, effectivePermissions] = await Promise.all([
            // Query A: Busca os departamentos vinculados
            this.db
                .select({ department: departments })
                .from(userDepartments)
                .innerJoin(departments, eq(userDepartments.departmentId, departments.id))
                .where(eq(userDepartments.userId, userId)),

            // Query B: Busca os objetos das permissões efetivas
            this.getEffectivePermissionsObjects(userId, user.isSuperUser),
        ]);

        return {
            ...user,
            departments: userDeps.map((d) => d.department),
            permissions: effectivePermissions,
        };
    }

    async create(data: CreateUserDTO, grantedById?: string): Promise<UserWithDepartmentsAndPermissions> {
        return await this.db.transaction(async (tx) => {
            const { departments: departmentsList, ...userData } = data;

            // Cria o usuário
            const [user] = await tx.insert(users).values(userData).returning();

            let depsListRet: Department[] = [];
            // Vincula o usuário aos departamentos
            if (departmentsList && departmentsList.length > 0) {
                const departmentsToInsert = departmentsList.map((depId) => ({
                    departmentId: depId,
                    userId: user.id,
                    grantedById: grantedById ?? null,
                }));

                await tx.insert(userDepartments).values(departmentsToInsert);

                // Recupera a lista de entidades de departamento para o retorno
                const depsList = await tx
                    .select({ department: departments })
                    .from(userDepartments)
                    .innerJoin(departments, eq(userDepartments.departmentId, departments.id))
                    .where(eq(userDepartments.userId, user.id));

                depsListRet = depsList.map((d) => d.department);
            }

            const permissionCols = getTableColumns(permissions);
            // Permissões Manuais (Neste momento do create estará vazia, mas a query serve de padrão)
            const manualPerms = tx
                .select(permissionCols)
                .from(userPermissions)
                .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
                .where(eq(userPermissions.userId, user.id));
            // Permissões Herdadas via Departamento
            const depPerms = tx
                .select(permissionCols)
                .from(userDepartments)
                .innerJoin(departmentPermissions, eq(userDepartments.departmentId, departmentPermissions.departmentId))
                .innerJoin(permissions, eq(departmentPermissions.permissionId, permissions.id))
                .where(eq(userDepartments.userId, user.id));

            // O UNION remove duplicatas automaticamente no nível do banco
            const effectivePermissions = await union(manualPerms, depPerms);

            return {
                ...user,
                departments: depsListRet,
                permissions: effectivePermissions, // Retorna os objetos completos deduplicados
            };
        });
    }

    async isUserSuperAdmin(userId: string): Promise<boolean> {
        const [result] = await this.db.select({ isSuperUser: users.isSuperUser }).from(users).where(eq(users.id, userId));
        return result.isSuperUser || false;
    }

    async getTokensRevokedAt(userId: string): Promise<Date | null> {
        const [user] = await this.db.select({ tokensRevokedAt: users.tokensRevokedAt }).from(users).where(eq(users.id, userId));

        // Retorna a data se existir, ou null
        return user?.tokensRevokedAt || null;
    }

    async setTokensRevokedAt(userId: string, date: Date): Promise<void> {
        await this.db.update(users).set({ tokensRevokedAt: date }).where(eq(users.id, userId));
    }

    async updatePassword(userId: string, newPassword: string, isEmailConfirmed?: boolean): Promise<User> {
        const updateData: { passwordHash: string; isEmailConfirmed?: boolean } = {
            passwordHash: newPassword,
        };

        // Caso o usuário não tenha verificado o e-mail ao resetar a senha já seta como confirmado,
        // pois entende-se que para trocar a senha ele já tem acesso ao e-mail
        if (!isEmailConfirmed) {
            updateData.isEmailConfirmed = true;
        }

        const [result] = await this.db.update(users).set(updateData).where(eq(users.id, userId)).returning();

        return result;
    }

    async updateLastLogin(userId: string, date: Date): Promise<void> {
        await this.db.update(users).set({ lastLoginAt: date }).where(eq(users.id, userId));
    }

    async confirmEmail(userId: string): Promise<void> {
        await this.db.update(users).set({ isEmailConfirmed: true, updatedAt: new Date() }).where(eq(users.id, userId));
    }

    // ============================================================================
    // FUNÇÃO AUXILIAR
    // ============================================================================
    private async getEffectivePermissionsObjects(userId: string, isSuperUser: boolean) {
        // Se for Super Admin, devolve a tabela inteira de permissões
        if (isSuperUser) {
            return await this.db.select().from(permissions);
        }

        // Colunas idênticas para garantir que o UNION do Postgres funcione perfeitamente
        // Baseado no snapshot 0020 (a coluna is_active foi removida)
        const permissionCols = getTableColumns(permissions);

        // Permissões atribuídas diretamente ao usuário
        const manualPerms = this.db
            .select(permissionCols)
            .from(userPermissions)
            .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
            .where(eq(userPermissions.userId, userId));

        // Permissões herdadas via departamentos
        const depPerms = this.db
            .select(permissionCols)
            .from(userDepartments)
            .innerJoin(departmentPermissions, eq(userDepartments.departmentId, departmentPermissions.departmentId))
            .innerJoin(permissions, eq(departmentPermissions.permissionId, permissions.id))
            .where(eq(userDepartments.userId, userId));

        // O UNION atua como um "DISTINCT" nativo no banco de dados, removendo duplicatas
        const results = await union(manualPerms, depPerms);

        return results;
    }
}
