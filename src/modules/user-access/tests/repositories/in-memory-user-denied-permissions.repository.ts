import { TransactionClient } from '@/database';
import { Permission } from '@/modules/permissions/types/permissions.types';
import { IUserDeniedPermissionsRepository } from '../../repositories/user-denied-permissions.repository';

export class InMemoryUserDeniedPermissionsRepository implements IUserDeniedPermissionsRepository {
    // ---------------------------------------------------------
    // Estruturas auxiliares públicas para popular os dados nos testes
    // ---------------------------------------------------------
    public permissions: Permission[] = [];

    // userId -> array de permissionIds (Permissões bloqueadas)
    public userDeniedPermissionsMap: Map<string, string[]> = new Map();

    // ---------------------------------------------------------
    // Implementação da Interface
    // ---------------------------------------------------------

    async checkPermissionsExist(ids: string[]): Promise<boolean> {
        if (!ids || ids.length === 0) {
            return true;
        }

        const existingIds = this.permissions.map((p) => p.id);
        return ids.every((id) => existingIds.includes(id));
    }

    async getRawDeniedPermissions(userId: string, _tx?: TransactionClient): Promise<Permission[]> {
        const deniedPermIds = this.userDeniedPermissionsMap.get(userId) || [];

        // Mapeia os IDs bloqueados para os objetos de permissão completos
        return this.permissions.filter((p) => deniedPermIds.includes(p.id));
    }

    async setDeniedPermissions(userId: string, permissionsIds: string[], _deniedById?: string): Promise<void> {
        // O set() no Map substitui o array antigo pelo novo,
        // imitando perfeitamente o seu `tx.delete()` seguido de `tx.insert()`
        this.userDeniedPermissionsMap.set(userId, permissionsIds);
    }

    async removeBlockedPermission(userId: string, permissionId: string): Promise<void> {
        const currentDenied = this.userDeniedPermissionsMap.get(userId) || [];

        this.userDeniedPermissionsMap.set(
            userId,
            currentDenied.filter((id) => id !== permissionId),
        );
    }

    async removeAllBlockedPermissions(userId: string): Promise<void> {
        this.userDeniedPermissionsMap.delete(userId);
    }
}
