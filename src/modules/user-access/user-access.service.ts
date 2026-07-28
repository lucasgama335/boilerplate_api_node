import { AppError } from '@/app/exceptions/AppError';
import { IUserPermissionsProvider } from '@/app/infra/user-permissions-provider/UserPermissionsProvider';
import { IUsersRepository } from '../users/repositories/users.repository';
import { SafeUserWithPermissions, toSafeUser } from '../users/types/users.types';
import { IUserPermissionsRepository } from './repositories/user-permissions.repository';

export class UserAccessService {
    constructor(
        private readonly usersRepository: IUsersRepository,
        private readonly userPermissionsRepository: IUserPermissionsRepository,
        private readonly userPermissionsProvider: IUserPermissionsProvider,
    ) {}

    async setUserPermissions(id: string, permissions: string[], grantedById?: string): Promise<SafeUserWithPermissions> {
        const user = await this.usersRepository.findById(id);
        if (!user) {
            throw new AppError('Usuário não encontrado na base de dados', 404);
        }

        // 🛡️ Valida se as permissões enviadas existem antes de processar a comparação
        if (permissions && permissions.length > 0) {
            const permissionsExist = await this.userPermissionsRepository.checkPermissionsExist(permissions);
            if (!permissionsExist) {
                throw new AppError('Um ou mais IDs de permissão informados são inválidos ou não existem.', 400);
            }
        } else {
            throw new AppError('A lista de permissões está vazia.', 400);
        }

        // Insere as permissões do usuário
        const userWithPermissions = await this.userPermissionsRepository.setPermissions(id, permissions, grantedById);
        await this.userPermissionsProvider.invalidatePermissions(id);

        return toSafeUser(userWithPermissions);
    }
}
