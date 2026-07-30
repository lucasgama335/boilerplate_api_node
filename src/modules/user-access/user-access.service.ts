import { AppError } from '@/common/exceptions/AppError';
import { IUserPermissionsProvider } from '@/modules/user-access/providers/user-access.provider';
import { IUsersRepository } from '../users/repositories/users.repository';
import { SafeUserWithPermissions, toSafeUser } from '../users/types/users.types';
import { IUserDeniedPermissionsRepository } from './repositories/user-denied-permissions.repository';
import { IUserPermissionsRepository } from './repositories/user-permissions.repository';

export class UserAccessService {
    constructor(
        private readonly usersRepository: IUsersRepository,
        private readonly userPermissionsRepository: IUserPermissionsRepository,
        private readonly userDeniedPermissionsRepository: IUserDeniedPermissionsRepository,
        private readonly userPermissionsProvider: IUserPermissionsProvider,
    ) {}

    async setUserPermissions(id: string, permissions: string[], grantedById?: string): Promise<SafeUserWithPermissions> {
        const user = await this.usersRepository.findById(id);
        if (!user) {
            throw new AppError('Usuário não encontrado na base de dados', 404);
        }

        // 🛡️ Se o array não for vazio, valida se os IDs existem. Se for vazio, passa direto (revogação total).
        if (permissions.length > 0) {
            const permissionsExist = await this.userPermissionsRepository.checkPermissionsExist(permissions);
            if (!permissionsExist) {
                throw new AppError('Um ou mais IDs de permissão informados são inválidos ou não existem.', 400);
            }
        }

        // Insere as permissões do usuário
        const userWithPermissions = await this.userPermissionsRepository.setPermissions(id, permissions, grantedById);
        await this.userPermissionsProvider.invalidatePermissions(id);

        return toSafeUser(userWithPermissions);
    }

    async setUserDeniedPermissions(id: string, permissions: string[], grantedById?: string): Promise<SafeUserWithPermissions> {
        const user = await this.usersRepository.findById(id);
        if (!user) {
            throw new AppError('Usuário não encontrado na base de dados', 404);
        }

        // 🛡️ Se o array não for vazio, valida se os IDs existem. Se for vazio, passa direto (revogação total).
        if (permissions.length > 0) {
            const permissionsExist = await this.userDeniedPermissionsRepository.checkPermissionsExist(permissions);
            if (!permissionsExist) {
                throw new AppError('Um ou mais IDs de permissão informados são inválidos ou não existem.', 400);
            }
        }

        // Insere as permissões do usuário, invalida as permissões no redis e retorna a nova lista de permissões
        await this.userDeniedPermissionsRepository.setDeniedPermissions(id, permissions, grantedById);
        await this.userPermissionsProvider.invalidatePermissions(id);
        const userPermissions = await this.userPermissionsRepository.getPermissionsByUserId(id);

        return { ...toSafeUser(user), permissions: userPermissions };
    }
}
