import { DatabaseType } from '@/database';
import { departments, userDepartments, users } from '@/database/schema';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { Department } from '../types/departments.types';

export interface IUserDepartmentsRepository {
    getDepartmentsByUserId(userId: string): Promise<Department[]>;
    getDepartmentsIdsByUserId(userId: string): Promise<string[]>;
    getDepartmentUsers(departmentId: string): Promise<string[]>;
    setDepartment(userId: string, departmentId: string, grantedById?: string): Promise<void>;
    removeDepartment(userId: string, departmentId: string): Promise<void>;
    removeAllDepartments(userId: string): Promise<void>;
}

export class DrizzleUserDepartmentsRepository implements IUserDepartmentsRepository {
    constructor(private readonly db: DatabaseType) {}

    async getDepartmentsByUserId(userId: string): Promise<Department[]> {
        const departmentsColumns = getTableColumns(departments);
        const results = await this.db
            .select(departmentsColumns)
            .from(userDepartments)
            .innerJoin(departments, eq(userDepartments.departmentId, departments.id))
            .where(eq(userDepartments.userId, userId));

        return results;
    }

    async getDepartmentsIdsByUserId(userId: string): Promise<string[]> {
        const results = await this.db.select({ departmentId: userDepartments.departmentId }).from(userDepartments).where(eq(userDepartments.userId, userId));

        return results.map((bond) => bond.departmentId);
    }

    async getDepartmentUsers(departmentId: string): Promise<string[]> {
        const results = await this.db
            .select({ id: users.id })
            .from(userDepartments)
            .innerJoin(users, eq(userDepartments.userId, users.id))
            .where(eq(userDepartments.departmentId, departmentId));

        return results.map((result) => result.id);
    }

    async setDepartment(userId: string, departmentId: string, grantedById?: string): Promise<void> {
        await this.db.insert(userDepartments).values({ userId, departmentId, grantedById }).onConflictDoNothing();
    }

    async removeDepartment(userId: string, departmentId: string): Promise<void> {
        const conditions = [eq(userDepartments.userId, userId), eq(userDepartments.departmentId, departmentId)];
        await this.db.delete(userDepartments).where(and(...conditions));
    }

    async removeAllDepartments(userId: string): Promise<void> {
        await this.db.delete(userDepartments).where(eq(userDepartments.userId, userId));
    }
}
