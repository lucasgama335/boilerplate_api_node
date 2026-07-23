import { DatabaseType } from '@/database';
import { users } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { IUserRepository } from '../domain/IUserRepository';
import { CreateUserData, User, UserWithPassword } from '../domain/User';

export class DrizzleUserRepository implements IUserRepository {
    constructor(private readonly db: DatabaseType) {}

    async findByEmail(email: string, showUserPasswordHash: boolean = false): Promise<User | UserWithPassword | null> {
        // Retorna um array, ex: [{ id: 1, email: '...' }] ou []
        const result = await this.db.select().from(users).where(eq(users.email, email));

        // Se o array estiver vazio, o usuário não existe. Retornamos null imediatamente.
        if (!result || result.length === 0) {
            return null;
        }
        const user = result[0];

        if (!showUserPasswordHash) {
            const { passwordHash, ...userWithoutPassword } = user;
            return userWithoutPassword || null;
        }

        // Se não tiver nada no índice 0, retorna null. Se tiver, retorna o objeto.
        return user || null;
    }

    async findById(id: string, showUserPasswordHash: boolean = false): Promise<User | UserWithPassword | null> {
        // Retorna um array, ex: [{ id: 1, email: '...' }] ou []
        const result = await this.db.select().from(users).where(eq(users.id, id));

        // Se o array estiver vazio, o usuário não existe. Retornamos null imediatamente.
        if (!result || result.length === 0) {
            return null;
        }
        const user = result[0];

        if (!showUserPasswordHash) {
            const { passwordHash, ...userWithoutPassword } = user;
            return userWithoutPassword || null;
        }

        // Se não tiver nada no índice 0, retorna null. Se tiver, retorna o objeto.
        return user || null;
    }

    async create(data: CreateUserData): Promise<User> {
        const result = await this.db.insert(users).values(data).returning();

        const createdUser = result[0];

        const { passwordHash, ...userWithoutPassword } = createdUser;

        return userWithoutPassword;
    }
}
