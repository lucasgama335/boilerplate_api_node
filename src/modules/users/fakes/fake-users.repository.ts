import { CreateUserDTO, SafeUser, User } from '../types/users.types';

export interface IFakeUserRepository {
    findByEmail(email: string, showUserPasswordHash: true): Promise<User | null>;
    findByEmail(email: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    findByEmail(email: string, showUserPasswordHash?: boolean): Promise<SafeUser | User | null>;

    findById(id: string, showUserPasswordHash: true): Promise<User | null>;
    findById(id: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    findById(id: string, showUserPasswordHash?: boolean): Promise<SafeUser | User | null>;

    create(data: CreateUserDTO): Promise<SafeUser>;
    isUserSuperAdmin(userId: string): Promise<boolean>;

    getTokensRevokedAt(userId: string): Promise<Date | null>;
    setTokensRevokedAt(userId: string, now: Date): Promise<void>;

    updatePassword(userId: string, newPassword: string): Promise<SafeUser>;
    updateLastLogin(userId: string, date: Date): Promise<void>;
    confirmEmail(userId: string): Promise<void>;
}

export type CreateFakeUserData = CreateUserDTO & {
    id?: string;
};

export class InMemoryUserRepository implements IFakeUserRepository {
    public items: User[] = [];

    async findByEmail(email: string, showUserPasswordHash: true): Promise<User | null>;
    async findByEmail(email: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    async findByEmail(email: string, showUserPasswordHash: boolean = false): Promise<SafeUser | User | null> {
        const user = this.items.find((item) => item.email === email);
        if (!user) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...userWithoutPassword } = user;
            return userWithoutPassword as SafeUser;
        }

        return user;
    }

    async findById(id: string, showUserPasswordHash: true): Promise<User | null>;
    async findById(id: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    async findById(id: string, showUserPasswordHash: boolean = false): Promise<SafeUser | User | null> {
        const user = this.items.find((item) => item.id === id);
        if (!user) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...userWithoutPassword } = user;
            return userWithoutPassword as SafeUser;
        }

        return user;
    }

    async create(data: CreateFakeUserData): Promise<SafeUser> {
        const newUser: User = {
            id: data.id ?? crypto.randomUUID(),
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            isEmailConfirmed: false,
            isSuperUser: false,
            totpSecret: null,
            isTwoFactorEnabled: false,
            tokensRevokedAt: null,
            passwordHash: data.passwordHash,
            lastLoginAt: null, // 👈 Inicializado como null
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.items.push(newUser);

        const { passwordHash: _, ...userWithoutPassword } = newUser;
        return userWithoutPassword;
    }

    async isUserSuperAdmin(userId: string): Promise<boolean> {
        const user = this.items.find((item) => item.id === userId);
        return user?.isSuperUser || false;
    }

    async getTokensRevokedAt(userId: string): Promise<Date | null> {
        const user = this.items.find((item) => item.id === userId);
        if (!user) {
            return null;
        }

        return user.tokensRevokedAt ?? null;
    }

    async setTokensRevokedAt(userId: string, now: Date): Promise<void> {
        const userIndex = this.items.findIndex((item) => item.id === userId);
        if (userIndex >= 0) {
            this.items[userIndex].tokensRevokedAt = now;
            this.items[userIndex].updatedAt = new Date();
        }
    }

    async updatePassword(userId: string, newPassword: string): Promise<SafeUser> {
        const userIndex = this.items.findIndex((item) => item.id === userId);
        if (userIndex === -1) {
            throw new Error('Usuário não encontrado');
        }

        this.items[userIndex].passwordHash = newPassword;
        this.items[userIndex].updatedAt = new Date();

        const { passwordHash: _, ...userWithoutPassword } = this.items[userIndex];
        return userWithoutPassword as SafeUser;
    }

    // 👈 Implementação da atualização de lastLoginAt
    async updateLastLogin(userId: string, date: Date): Promise<void> {
        const userIndex = this.items.findIndex((item) => item.id === userId);
        if (userIndex === -1) {
            throw new Error('Usuário não encontrado');
        }

        this.items[userIndex].lastLoginAt = date;
        this.items[userIndex].updatedAt = new Date();
    }

    async confirmEmail(userId: string): Promise<void> {
        const userIndex = this.items.findIndex((item) => item.id === userId);
        if (userIndex === -1) {
            throw new Error('Usuário não encontrado');
        }

        this.items[userIndex].isEmailConfirmed = true;
    }
}
