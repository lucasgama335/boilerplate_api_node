import { ITokenValidityProvider } from '@/app/infra/token-validity/TokenValidityProvider';
import { IUserRepository } from '@/modules/users/users.repository';

export class InMemoryTokenValidityProvider implements ITokenValidityProvider {
    constructor(private readonly userRepository: IUserRepository) {}

    async getRevokedAt(userId: string): Promise<Date | null> {
        // Nos testes unitários, pulamos o Redis e lemos direto do repositório fake em memória
        return await this.userRepository.getTokensRevokedAt(userId);
    }

    async revokeAllTokens(userId: string): Promise<void> {
        const now = new Date();
        // Atualiza a data de revogação no repositório fake em memória
        await this.userRepository.setTokensRevokedAt(userId, now);
    }
}
