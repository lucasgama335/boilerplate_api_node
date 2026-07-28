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

    async getPermissionsByUserId(userId: string): Promise<string[]> {
        return this.userPermissionsMap.get(userId) || [];
    }

    async getPermissionsCode(userId: string): Promise<string[]> {
        const user = this.users.find((u) => u.id === userId);

        // 1. Se for Super Admin, tem acesso a tudo
        if (user?.isSuperUser) {
            return ['*'];
        }

        // 2. Códigos manuais
        const manualPermIds = this.userPermissionsMap.get(userId) || [];

        // 3. Códigos herdados de departamentos
        const depIds = this.userDepartmentsMap.get(userId) || [];
        const depPermIds = depIds.flatMap((dId) => this.departmentPermissionsMap.get(dId) || []);

        // 4. Junta tudo e remove duplicatas (Set)
        const allPermIds = [...new Set([...manualPermIds, ...depPermIds])];

        // 5. Mapeia para os códigos em texto reais das permissões (ex: "users:create")
        const codes = this.permissions.filter((p) => allPermIds.includes(p.id)).map((p) => p.code);

        return [...new Set(codes)]; // Garantia extra contra códigos duplicados
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
