import { DatabaseType } from '@/database';
import { departments, userDepartments, users } from '@/database/schema';
import { eq, inArray } from 'drizzle-orm';
import { CreateUserDTO, User } from '../types/users.types';

export interface IUsersRepository {
    checkDepartmentsExist(ids: string[]): Promise<boolean>;

    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;

    create(data: CreateUserDTO, grantedById?: string): Promise<User>;

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

    async create(data: CreateUserDTO, grantedById?: string): Promise<User> {
        return await this.db.transaction(async (tx) => {
            const { departments: departmentsList, ...userData } = data;

            // Cria o usuário
            const [user] = await tx.insert(users).values(userData).returning();

            // Vincula o usuário aos departamentos
            if (departmentsList && departmentsList.length > 0) {
                const departmentsToInsert = departmentsList.map((depId) => ({
                    departmentId: depId,
                    userId: user.id,
                    grantedById: grantedById ?? null,
                }));

                await tx.insert(userDepartments).values(departmentsToInsert);
            }

            return { ...user };
        });
    }

    async isUserSuperAdmin(userId: string): Promise<boolean> {
        const [result] = await this.db.select({ isSuperUser: users.isSuperUser }).from(users).where(eq(users.id, userId));
        return result?.isSuperUser || false;
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
}
