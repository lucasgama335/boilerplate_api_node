import { DatabaseType } from '@/database';
import { loginAttempts } from '@/database/schema';
import { ILoginAttemptsRepository } from '../domain/ILoginAttemptsRepository';
import { LoginAttempt } from '../domain/LoginAttempt';

export class LoginAttemptsRepository implements ILoginAttemptsRepository {
    constructor(private readonly db: DatabaseType) {}

    async generateAttempt(status: 'success' | 'fail', ipAddress: string, email?: string, userId?: string): Promise<LoginAttempt | null> {
        const [attempt] = await this.db
            .insert(loginAttempts)
            .values({ status, ipAddress, email: email ?? null, userId: userId ?? null })
            .returning();

        return attempt || null;
    }
}
