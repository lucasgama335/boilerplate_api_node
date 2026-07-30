import { TransactionClient } from '@/database';
import { Permission } from '@/modules/permissions/types/permissions.types';
import { User, UserWithPermissions } from '@/modules/users/types/users.types';
import { IUserPermissionsRepository } from '../../repositories/user-permissions.repository';

export class InMemoryUserPermissionsRepository implements IUserPermissionsRepository {
    // ---------------------------------------------------------
    // Estruturas auxiliares públicas para popular os dados nos testes
    // ---------------------------------------------------------
    public users: User[] = [];
    public permissions: Permission[] = [];

    // userId -> array de permissionIds (Permissões atribuídas manualmente)
    public userPermissionsMap: Map<string, string[]> = new Map();

    // Estruturas auxiliares para simular a herança de permissões via departamento
    // (usado pelo getPermissionsCode na montagem dos tokens e middlewares)
    public userDepartmentsMap: Map<string, string[]> = new Map();
    public departmentPermissionsMap: Map<string, string[]> = new Map();
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

    async getPermissionsByUserId(userId: string, _tx?: TransactionClient): Promise<Permission[]> {
        const user = this.users.find((u) => u.id === userId);

        if (user?.isSuperUser) {
            return [...this.permissions];
        }

        const manualPermIds = this.userPermissionsMap.get(userId) || [];
        const depIds = this.userDepartmentsMap.get(userId) || [];
        const depPermIds = depIds.flatMap((dId) => this.departmentPermissionsMap.get(dId) || []);

        const allPermIds = [...new Set([...manualPermIds, ...depPermIds])];
        let allowedPermissions = this.permissions.filter((p) => allPermIds.includes(p.id));

        const deniedPermIds = this.userDeniedPermissionsMap.get(userId) || [];
        const deniedSet = new Set(deniedPermIds);

        allowedPermissions = allowedPermissions.filter((perm) => !deniedSet.has(perm.id));

        return allowedPermissions;
    }

    async getPermissionsCode(userId: string): Promise<string[]> {
        const user = this.users.find((u) => u.id === userId);

        if (user?.isSuperUser) {
            return ['*'];
        }

        const manualPermIds = this.userPermissionsMap.get(userId) || [];
        const depIds = this.userDepartmentsMap.get(userId) || [];
        const depPermIds = depIds.flatMap((dId) => this.departmentPermissionsMap.get(dId) || []);

        const allPermIds = [...new Set([...manualPermIds, ...depPermIds])];

        const deniedPermIds = this.userDeniedPermissionsMap.get(userId) || [];
        const deniedSet = new Set(deniedPermIds);

        const finalPermIds = allPermIds.filter((id) => !deniedSet.has(id));

        const codes = this.permissions.filter((p) => finalPermIds.includes(p.id)).map((p) => p.code);

        return [...new Set(codes)];
    }

    async getUserIdsByPermissionId(permissionId: string): Promise<string[]> {
        const userIds = new Set<string>();

        // 1. Procura usuários que possuem a permissão diretamente
        for (const [userId, permIds] of this.userPermissionsMap.entries()) {
            if (permIds.includes(permissionId)) {
                userIds.add(userId);
            }
        }

        // 2. Procura usuários que herdam a permissão através de departamentos
        for (const [departmentId, permIds] of this.departmentPermissionsMap.entries()) {
            if (permIds.includes(permissionId)) {
                // Descobre quais usuários pertencem a este departamento
                for (const [userId, depIds] of this.userDepartmentsMap.entries()) {
                    if (depIds.includes(departmentId)) {
                        userIds.add(userId);
                    }
                }
            }
        }

        return Array.from(userIds);
    }

    async setPermissions(userId: string, permissionsIds: string[], _grantedById?: string): Promise<UserWithPermissions> {
        // 1. Atualiza/Substitui as permissões do usuário
        this.userPermissionsMap.set(userId, permissionsIds);

        // 2. Busca o usuário base
        const user = this.users.find((u) => u.id === userId);
        if (!user) {
            throw new Error('Usuário base não encontrado no repositório em memória.');
        }

        // 3. Busca os objetos completos das permissões selecionadas
        const associatedPermissions = this.permissions.filter((p) => permissionsIds.includes(p.id));

        return {
            ...user,
            permissions: associatedPermissions,
        };
    }

    async removePermission(userId: string, permissionId: string): Promise<void> {
        const currentPerms = this.userPermissionsMap.get(userId) || [];
        this.userPermissionsMap.set(
            userId,
            currentPerms.filter((id) => id !== permissionId),
        );
    }

    async removeAllPermissions(userId: string): Promise<void> {
        this.userPermissionsMap.delete(userId);
    }
}
