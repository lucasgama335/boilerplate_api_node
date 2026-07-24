import { DatabaseType } from '@/database';
import { loginAttempts } from '@/database/schema';
import { LoginAttempt } from './authentication.types';

export interface ILoginAttemptsRepository {
    generateAttempt(
        status: 'success' | 'fail',
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        email?: string,
        userId?: string,
    ): Promise<LoginAttempt | null>;
}

export class LoginAttemptsRepository implements ILoginAttemptsRepository {
    constructor(private readonly db: DatabaseType) {}

    async generateAttempt(
        status: 'success' | 'fail',
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        email?: string,
        userId?: string,
    ): Promise<LoginAttempt | null> {
        const [attempt] = await this.db
            .insert(loginAttempts)
            .values({ status, ipAddress, city, region, country, os, deviceType, email: email ?? null, userId: userId ?? null })
            .returning();

        return attempt || null;
    }
}
