/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/common/exceptions/AppError';
import { IUserPermissionsProvider } from '@/modules/user-access/providers/user-access.provider';
import { makeCreateUser } from '@/modules/users/tests/factories/users.factory';
import { InMemoryUsersRepository } from '@/modules/users/tests/repositories/in-memory-users.repository';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAccessService } from '../user-access.service';
import { InMemoryUserPermissionsRepository } from './repositories/in-memory-user-access.repository';

describe('[UNIT TEST]: Módulo de User Access - Service', () => {
    let usersRepository: InMemoryUsersRepository;
    let userPermissionsRepository: InMemoryUserPermissionsRepository;
    let mockUserPermissionsProvider: IUserPermissionsProvider;

    let userAccessService: UserAccessService;

    beforeEach(() => {
        usersRepository = new InMemoryUsersRepository();
        userPermissionsRepository = new InMemoryUserPermissionsRepository();

        mockUserPermissionsProvider = {
            invalidatePermissions: vi.fn(),
            getPermissions: vi.fn(),
            invalidatePermissionsByDepartment: vi.fn(),
            invalidatePermissionsByPermission: vi.fn(),
        };

        userAccessService = new UserAccessService(usersRepository, userPermissionsRepository, mockUserPermissionsProvider);
    });

    describe('[method]: #setUserPermissions', () => {
        it('deve lançar AppError 404 se o usuário não for encontrado no banco de dados', async () => {
            await expect(userAccessService.setUserPermissions('id-inexistente', ['perm-1'])).rejects.toBeInstanceOf(AppError);
            await expect(userAccessService.setUserPermissions('id-inexistente', ['perm-1'])).rejects.toMatchObject({
                statusCode: 404,
                message: 'Usuário não encontrado na base de dados',
            });
        });

        it('deve lançar AppError 400 se algum ID de permissão enviado não existir no banco de dados', async () => {
            const createdUser = await usersRepository.create(makeCreateUser());

            // Cadastramos apenas uma permissão válida no repositório
            userPermissionsRepository.permissions.push({
                id: 'perm-valida-123',
                code: 'users:manage',
                description: 'Manage users',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Passamos uma válida e uma inválida
            await expect(userAccessService.setUserPermissions(createdUser.id, ['perm-valida-123', 'perm-invalida-999'])).rejects.toBeInstanceOf(AppError);
            await expect(userAccessService.setUserPermissions(createdUser.id, ['perm-valida-123', 'perm-invalida-999'])).rejects.toMatchObject({
                statusCode: 400,
                message: 'Um ou mais IDs de permissão informados são inválidos ou não existem.',
            });
        });

        it('deve atribuir as permissões com sucesso, invalidar o cache e retornar os dados sanitizados', async () => {
            // 1. Criamos o usuário e sincronizamos entre os repositórios em memória
            const createdUser = await usersRepository.create(makeCreateUser());
            userPermissionsRepository.users.push(createdUser as any);

            // 2. Populamos as permissões válidas no banco
            userPermissionsRepository.permissions.push(
                { id: 'perm-1', code: 'users:read', description: 'Ver usuários', createdAt: new Date(), updatedAt: new Date() },
                { id: 'perm-2', code: 'users:write', description: 'Criar usuários', createdAt: new Date(), updatedAt: new Date() },
            );

            // 3. Executamos o Service
            const grantedById = 'admin-123';
            const result = await userAccessService.setUserPermissions(createdUser.id, ['perm-1', 'perm-2'], grantedById);

            // 4. Asserções do Retorno e Sanitização (toSafeUser)
            expect(result).toHaveProperty('id', createdUser.id);
            expect(result).not.toHaveProperty('passwordHash'); // Garante que não vazou a senha
            expect(result.permissions).toHaveLength(2);
            expect(result.permissions[0].code).toBe('users:read');

            // 5. Asserções de Persistência no Banco em Memória
            const savedPerms = await userPermissionsRepository.getPermissionsByUserId(createdUser.id);
            expect(savedPerms).toEqual(['perm-1', 'perm-2']);

            // 6. Asserções de Invalidação de Cache
            expect(mockUserPermissionsProvider.invalidatePermissions).toHaveBeenCalledWith(createdUser.id);
        });
    });
});
