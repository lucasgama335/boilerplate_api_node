import { IUserSessionRevocationProvider } from '@/app/infra/user-session-revocation/UserSessionRevocationProvider';
import { IUserRepository } from '@/modules/users/users.repository';

// Bypassa o Redis inteiramente — usado quando o que se quer testar é o
// AuthenticateUserService, não a lógica de cache em si (essa tem teste dedicado
// em UserSessionRevocationProvider.spec.ts, usando InMemoryRedisCache).
export class InMemoryUserSessionRevocationProvider implements IUserSessionRevocationProvider {
    constructor(private readonly userRepository: IUserRepository) {}

    async getRevokedAt(userId: string): Promise<Date | null> {
        return await this.userRepository.getTokensRevokedAt(userId);
    }

    async revokeAllTokens(userId: string): Promise<void> {
        const now = new Date();
        await this.userRepository.setTokensRevokedAt(userId, now);
    }
}
