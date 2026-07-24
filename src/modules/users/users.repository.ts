import { DatabaseType } from '@/database';
import { users } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { CreateUserData, User, UserWithPassword } from './users.types';

export interface IUserRepository {
    // Como o tipo de retorno depende do parâmetro showUserPasswordHash precisamos fazer
    // uma sobrecarga de função para garantir o resultado retornado em cada cenário.
    findByEmail(email: string, showUserPasswordHash: true): Promise<UserWithPassword | null>;
    findByEmail(email: string, showUserPasswordHash?: false): Promise<User | null>;
    findByEmail(email: string, showUserPasswordHash?: boolean): Promise<User | UserWithPassword | null>;

    findById(id: string, showUserPasswordHash: true): Promise<UserWithPassword | null>;
    findById(id: string, showUserPasswordHash?: false): Promise<User | null>;
    findById(id: string, showUserPasswordHash?: boolean): Promise<User | UserWithPassword | null>;

    create(data: CreateUserData): Promise<User>;

    getTokensRevokedAt(userId: string): Promise<Date | null>;
    setTokensRevokedAt(userId: string, now: Date): Promise<void>;
}

export class DrizzleUserRepository implements IUserRepository {
    constructor(private readonly db: DatabaseType) {}

    async findByEmail(email: string, showUserPasswordHash: true): Promise<UserWithPassword | null>;
    async findByEmail(email: string, showUserPasswordHash?: boolean): Promise<User | null>;
    async findByEmail(email: string, showUserPasswordHash: boolean = false): Promise<User | UserWithPassword | null> {
        // Retorna um array, ex: [{ id: 1, email: '...' }] ou []
        // Usamos a variável dentro de colchetes pq faz com que o javascript já retorne o primeiro item do array retornado tornando a variável o objeto em si.
        const [result] = await this.db.select().from(users).where(eq(users.email, email));
        if (!result) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...userWithoutPassword } = result;
            return (userWithoutPassword as User) || null;
        }

        return (result as UserWithPassword) || null;
    }

    async findById(id: string, showUserPasswordHash: true): Promise<UserWithPassword | null>;
    async findById(id: string, showUserPasswordHash?: boolean): Promise<User | null>;
    async findById(id: string, showUserPasswordHash: boolean = false): Promise<User | UserWithPassword | null> {
        const [result] = await this.db.select().from(users).where(eq(users.id, id));
        if (!result) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...userWithoutPassword } = result;
            return (userWithoutPassword as User) || null;
        }

        return (result as UserWithPassword) || null;
    }

    async create(data: CreateUserData): Promise<User> {
        const [result] = await this.db.insert(users).values(data).returning();

        const { passwordHash: _, ...userWithoutPassword } = result;

        return userWithoutPassword;
    }

    async getTokensRevokedAt(userId: string): Promise<Date | null> {
        const [user] = await this.db.select({ tokensRevokedAt: users.tokensRevokedAt }).from(users).where(eq(users.id, userId));

        // Retorna a data se existir, ou null
        return user?.tokensRevokedAt || null;
    }

    async setTokensRevokedAt(userId: string, date: Date): Promise<void> {
        await this.db.update(users).set({ tokensRevokedAt: date }).where(eq(users.id, userId));
    }
}
