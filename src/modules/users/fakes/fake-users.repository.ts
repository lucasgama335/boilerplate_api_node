import { CreateUser, SafeUser, User } from '../users.types';

export interface IFakeUserRepository {
    // Como o tipo de retorno depende do parâmetro showUserPasswordHash precisamos fazer
    // uma sobrecarga de função para garantir o resultado retornado em cada cenário.
    findByEmail(email: string, showUserPasswordHash: true): Promise<User | null>;
    findByEmail(email: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    findByEmail(email: string, showUserPasswordHash?: boolean): Promise<SafeUser | User | null>;

    findById(id: string, showUserPasswordHash: true): Promise<User | null>;
    findById(id: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    findById(id: string, showUserPasswordHash?: boolean): Promise<SafeUser | User | null>;

    create(data: CreateUser): Promise<SafeUser>;

    getTokensRevokedAt(userId: string): Promise<Date | null>;
    setTokensRevokedAt(userId: string, now: Date): Promise<void>;
}

export type CreateFakeUserData = CreateUser & {
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
            totpSecret: null,
            isTwoFactorEnabled: false,
            tokensRevokedAt: null,
            passwordHash: data.passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.items.push(newUser);

        const { passwordHash: _, ...userWithoutPassword } = newUser;
        return userWithoutPassword;
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
}
