import { LoginAttempt } from './LoginAttempt';

export interface ILoginAttemptsRepository {
    generateAttempt(status: 'success' | 'fail', ipAddress: string, email?: string, userId?: string): Promise<LoginAttempt | null>;
}
