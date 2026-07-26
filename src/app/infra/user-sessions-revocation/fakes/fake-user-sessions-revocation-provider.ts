import { IUserSessionsRevocationProvider } from '@/app/infra/user-sessions-revocation/UserSessionsRevocationProvider';
import { IFakeUserRepository } from '@/modules/users/fakes/fake-users.repository';

// Bypassa o Redis inteiramente — usado quando o que se quer testar é o
// AuthenticationUserService, não a lógica de cache em si (essa tem teste dedicado
// em UserSessionRevocationProvider.spec.ts, usando InMemoryRedisCache).
export class InMemoryUserSessionsRevocationProvider implements IUserSessionsRevocationProvider {
    constructor(private readonly userRepository: IFakeUserRepository) {}

    async getRevokedAt(userId: string): Promise<Date | null> {
        return await this.userRepository.getTokensRevokedAt(userId);
    }

    async revokeAllTokens(userId: string): Promise<void> {
        const now = new Date();
        await this.userRepository.setTokensRevokedAt(userId, now);
    }
}
