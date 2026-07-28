import { ILoginAttemptsRepository } from '../../repositories/login-attempts.repository';
import { LoginAttempt } from '../../types/authentication.types';

export class InMemoryLoginAttemptsRepository implements ILoginAttemptsRepository {
    // ---------------------------------------------------------
    // Estrutura auxiliar pública para verificarmos os testes
    // ---------------------------------------------------------
    public items: LoginAttempt[] = [];

    // ---------------------------------------------------------
    // Implementação da Interface
    // ---------------------------------------------------------
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
        // Criamos o objeto simulando o retorno do banco de dados
        const newAttempt: LoginAttempt = {
            id: `attempt-${Math.random().toString(36).substring(2, 9)}`,
            status,
            ipAddress,
            city,
            region,
            country,
            os,
            deviceType,
            browser: null,
            email: email ?? null,
            userId: userId ?? null,
            createdAt: new Date(),
        };

        // Salvamos no nosso "banco de dados" em memória
        this.items.push(newAttempt);

        return newAttempt;
    }
}
