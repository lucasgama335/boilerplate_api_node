import { IUsersRepository } from '../../repositories/users.repository';
import { CreateUserDTO, User } from '../../types/users.types';

export class InMemoryUsersRepository implements IUsersRepository {
    public items: User[] = [];
    public validDepartmentIds: Set<string> = new Set();

    // Auxiliar para simular a criação de vínculos (se necessário nos testes de outro módulo)
    public userDepartmentsMap: Map<string, string[]> = new Map();

    async checkDepartmentsExist(ids: string[]): Promise<boolean> {
        if (!ids || ids.length === 0) return true;
        return ids.every((id) => this.validDepartmentIds.has(id));
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.items.find((u) => u.email === email) || null;
    }

    async findById(id: string): Promise<User | null> {
        return this.items.find((u) => u.id === id) || null;
    }

    // 👇 O Create agora retorna apenas a entidade User limpa, igual ao Drizzle
    async create(data: CreateUserDTO, _grantedById?: string): Promise<User> {
        const { departments: departmentsList, ...userData } = data;

        const newUser: User = {
            id: `user-${Math.random().toString(36).substring(2, 9)}`,
            isSuperUser: false,
            isEmailConfirmed: false,
            tokensRevokedAt: null,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...userData,
            totpSecret: userData.totpSecret ?? null,
            isTwoFactorEnabled: userData.isTwoFactorEnabled ?? false,
        };

        this.items.push(newUser);

        if (departmentsList && departmentsList.length > 0) {
            this.userDepartmentsMap.set(newUser.id, departmentsList);
        }

        return newUser;
    }

    async isUserSuperAdmin(userId: string): Promise<boolean> {
        return this.items.find((u) => u.id === userId)?.isSuperUser || false;
    }

    async getTokensRevokedAt(userId: string): Promise<Date | null> {
        return this.items.find((u) => u.id === userId)?.tokensRevokedAt || null;
    }

    async setTokensRevokedAt(userId: string, date: Date): Promise<void> {
        const user = this.items.find((u) => u.id === userId);
        if (user) user.tokensRevokedAt = date;
    }

    async updatePassword(userId: string, newPassword: string, isEmailConfirmed?: boolean): Promise<User> {
        const userIndex = this.items.findIndex((u) => u.id === userId);
        if (userIndex !== -1) {
            this.items[userIndex].passwordHash = newPassword;
            if (!isEmailConfirmed) this.items[userIndex].isEmailConfirmed = true;
        }
        return this.items[userIndex];
    }

    async updateLastLogin(userId: string, date: Date): Promise<void> {
        const user = this.items.find((u) => u.id === userId);
        if (user) user.lastLoginAt = date;
    }

    async confirmEmail(userId: string): Promise<void> {
        const user = this.items.find((u) => u.id === userId);
        if (user) {
            user.isEmailConfirmed = true;
            user.updatedAt = new Date();
        }
    }
}
