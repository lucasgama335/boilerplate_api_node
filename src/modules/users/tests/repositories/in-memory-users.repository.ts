/* eslint-disable no-useless-assignment */
import { Department } from '@/modules/departments/types/departments.types';
import { Permission } from '@/modules/permissions/types/permissions.types';
import { IUsersRepository } from '../../repositories/users.repository';
import { CreateUserDTO, SafeUser, SafeUserWithDepartmentsAndPermissions, User } from '../../types/users.types';

export class InMemoryUsersRepository implements IUsersRepository {
    // ---------------------------------------------------------
    // Estruturas auxiliares públicas para popular os dados nos testes
    // ---------------------------------------------------------
    public items: User[] = [];
    public validDepartmentIds: Set<string> = new Set();

    public mockDepartments: Department[] = [];
    public mockPermissions: Permission[] = [];

    // userId -> array de departmentIds
    public userDepartmentsMap: Map<string, string[]> = new Map();
    // userId -> array de permissionIds (permissões diretas)
    public userPermissionsMap: Map<string, string[]> = new Map();
    // departmentId -> array de permissionIds (permissões do setor)
    public departmentPermissionsMap: Map<string, string[]> = new Map();

    // ---------------------------------------------------------
    // Implementação da Interface
    // ---------------------------------------------------------

    async checkDepartmentsExist(ids: string[]): Promise<boolean> {
        if (!ids || ids.length === 0) {
            return true;
        }
        return ids.every((id) => this.validDepartmentIds.has(id));
    }

    async findByEmail(email: string, showUserPasswordHash: true): Promise<User | null>;
    async findByEmail(email: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    async findByEmail(email: string, showUserPasswordHash: boolean = false): Promise<SafeUser | User | null> {
        const user = this.items.find((u) => u.email === email);
        if (!user) return null;

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...safeUser } = user;
            return safeUser as SafeUser;
        }

        return user;
    }

    async findById(id: string, showUserPasswordHash: true): Promise<User | null>;
    async findById(id: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    async findById(id: string, showUserPasswordHash: boolean = false): Promise<SafeUser | User | null> {
        const user = this.items.find((u) => u.id === id);
        if (!user) return null;

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...safeUser } = user;
            return safeUser as SafeUser;
        }

        return user;
    }

    async findByIdWithDetails(userId: string): Promise<SafeUserWithDepartmentsAndPermissions | null> {
        const user = this.items.find((u) => u.id === userId);
        if (!user) return null;

        // 1. Departamentos do usuário
        const depIds = this.userDepartmentsMap.get(userId) || [];
        const userDeps = this.mockDepartments.filter((dep) => depIds.includes(dep.id));

        // 2. Permissões Efetivas
        let effectivePermissions: Permission[] = [];
        if (user.isSuperUser) {
            effectivePermissions = [...this.mockPermissions];
        } else {
            // A. Permissões diretas
            const manualPermIds = this.userPermissionsMap.get(userId) || [];

            // B. Permissões herdadas dos departamentos
            const depPermIds = depIds.flatMap((dId) => this.departmentPermissionsMap.get(dId) || []);

            // C. UNION (remover duplicatas usando Set)
            const allPermIds = [...new Set([...manualPermIds, ...depPermIds])];
            effectivePermissions = this.mockPermissions.filter((p) => allPermIds.includes(p.id));
        }

        const { passwordHash: _, ...safeUser } = user;

        return {
            ...safeUser,
            departments: userDeps,
            permissions: effectivePermissions,
        } as SafeUserWithDepartmentsAndPermissions;
    }

    async create(data: CreateUserDTO, _grantedById?: string): Promise<SafeUserWithDepartmentsAndPermissions> {
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
        } as User; // Ajuste o cast de acordo com a sua tipagem estrita do schema do Drizzle

        this.items.push(newUser);

        if (departmentsList && departmentsList.length > 0) {
            this.userDepartmentsMap.set(newUser.id, departmentsList);
        }

        // Reaproveitamos a função que já monta o objeto completo com departamentos e permissões calculadas
        return (await this.findByIdWithDetails(newUser.id)) as SafeUserWithDepartmentsAndPermissions;
    }

    async isUserSuperAdmin(userId: string): Promise<boolean> {
        const user = this.items.find((u) => u.id === userId);
        return user?.isSuperUser || false;
    }

    async getTokensRevokedAt(userId: string): Promise<Date | null> {
        const user = this.items.find((u) => u.id === userId);
        return user?.tokensRevokedAt || null;
    }

    async setTokensRevokedAt(userId: string, date: Date): Promise<void> {
        const user = this.items.find((u) => u.id === userId);
        if (user) {
            user.tokensRevokedAt = date;
        }
    }

    async updatePassword(userId: string, newPassword: string, isEmailConfirmed?: boolean): Promise<SafeUser> {
        const userIndex = this.items.findIndex((u) => u.id === userId);

        if (userIndex !== -1) {
            this.items[userIndex].passwordHash = newPassword;
            if (!isEmailConfirmed) {
                this.items[userIndex].isEmailConfirmed = true;
            }
        }

        const { passwordHash: _, ...safeUser } = this.items[userIndex];
        return safeUser as SafeUser;
    }

    async updateLastLogin(userId: string, date: Date): Promise<void> {
        const user = this.items.find((u) => u.id === userId);
        if (user) {
            user.lastLoginAt = date;
        }
    }

    async confirmEmail(userId: string): Promise<void> {
        const user = this.items.find((u) => u.id === userId);
        if (user) {
            user.isEmailConfirmed = true;
            user.updatedAt = new Date();
        }
    }
}
