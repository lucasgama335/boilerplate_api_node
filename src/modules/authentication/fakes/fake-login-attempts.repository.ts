import * as crypto from 'node:crypto';
import { LoginAttempt } from '../authentication.types';

export interface IFakeLoginAttemptsRepository {
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

export class InMemoryLoginAttemptsRepository implements IFakeLoginAttemptsRepository {
    // Array interno para armazenar as tentativas de login em memória
    public items: LoginAttempt[] = [];

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
        const newAttempt: LoginAttempt = {
            id: crypto.randomUUID(),
            status,
            ipAddress,
            city,
            region,
            country,
            os,
            deviceType,
            browser: 'Mozilla',
            email: email ?? null,
            userId: userId ?? null,
            createdAt: new Date(),
        };

        this.items.push(newAttempt);

        return newAttempt;
    }
}
