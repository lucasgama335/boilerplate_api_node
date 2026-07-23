import { DatabaseType } from '@/database';
import { users } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { IUserRepository } from '../domain/IUserRepository';
import { CreateUserData, User, UserWithPassword } from '../domain/User';

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
            const { passwordHash, ...userWithoutPassword } = result;
            return (userWithoutPassword as User) || null;
        }

        return (result as UserWithPassword) || null;
    }

    async findById(id: string, showUserPasswordHash: true): Promise<UserWithPassword | null>;
    async findById(id: string, showUserPasswordHash?: boolean): Promise<User | null>;
    async findById(id: string, showUserPasswordHash: boolean = false): Promise<User | UserWithPassword | null> {
        // Retorna um array, ex: [{ id: 1, email: '...' }] ou []
        const [result] = await this.db.select().from(users).where(eq(users.id, id));
        if (!result) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash, ...userWithoutPassword } = result;
            return (userWithoutPassword as User) || null;
        }

        // Se não tiver nada no índice 0, retorna null. Se tiver, retorna o objeto.
        return (result as UserWithPassword) || null;
    }

    async create(data: CreateUserData): Promise<User> {
        const [result] = await this.db.insert(users).values(data).returning();

        const { passwordHash, ...userWithoutPassword } = result;

        return userWithoutPassword;
    }
}
