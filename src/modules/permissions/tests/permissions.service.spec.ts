import { AppError } from '@/app/exceptions/AppError';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsService } from '../permissions.service';
import { IPermissionsRepository } from '../repositories/permissions.repository';
import { CreatePermissionDTO, UpdatePermissionDTO } from '../types/permissions.types';
import { InMemoryPermissionsRepository } from './repositories/in-memory-permissions.repository';

describe('[UNIT TEST]: Módulo de Permissões - Service', () => {
    let permissionsRepository: IPermissionsRepository;

    let permissionsService: PermissionsService;
    beforeEach(() => {
        permissionsRepository = new InMemoryPermissionsRepository();

        permissionsService = new PermissionsService(permissionsRepository);
    });

    describe('[method]: #list', () => {
        it('deve calcular o totalPages corretamente, retornando 1 quando o total de itens for 0', async () => {
            const page = 1;
            const limit = 1;

            const results = await permissionsService.list(page, limit);

            expect(results).toHaveProperty('meta.totalPages');
            expect(results.meta.totalPages).toBe(1);
        });

        it('deve paginar os departamentos corretamente respeitando o limite e o total de registros', async () => {
            const page = 1;
            const limit = 2;

            await permissionsRepository.create({ code: 'users:show', description: 'Ver usuário' });
            await permissionsRepository.create({ code: 'users:create', description: 'Criar usuário' });
            await permissionsRepository.create({ code: 'users:update', description: 'Atualizar usuário' });

            const result = await permissionsService.list(page, limit);

            expect(result.permissions).toHaveLength(2);
            expect(result).toHaveProperty('meta.total');
            expect(result.meta.total).toBe(3);
        });

        it('deve calcular os parâmetros do meta corretamente com alto volume de dados', async () => {
            const page = 2;
            const limit = 10;
            const totalRegisters = 50;

            for (let i = 0; i < totalRegisters; i++) {
                await permissionsService.create({
                    code: `code-${i}`,
                    description: 'tes de código',
                });
            }

            const results = await permissionsService.list(page, limit);
            const totalPages = Math.ceil(totalRegisters / limit) || 1;

            expect(results).toHaveProperty('meta.totalPages');
            expect(results.meta.totalPages).toBe(totalPages);
            expect(results.meta.total).toBe(totalRegisters);
        });
    });

    describe('[method]: #show', () => {
        it('deve lançar AppError 404 quando a permissão não for encontrada', async () => {
            const nonExistentId = 'id-inexistente';

            await expect(permissionsService.show(nonExistentId)).rejects.toBeInstanceOf(AppError);
            await expect(permissionsService.show(nonExistentId)).rejects.toMatchObject({
                statusCode: 404,
                message: 'Permissão não encontrada em nossa base de dados.',
            });
        });

        it('deve retornar a permissão quando ela existir no banco', async () => {
            const createdPermission = await permissionsRepository.create({
                id: 'id-teste-banco',
                code: 'permissions:create',
                description: 'Criar permissões',
            });

            const result = await permissionsService.show(createdPermission.id);

            expect(result).not.toBeNull();
            expect(result).toHaveProperty('id');
            expect(result.id).toBe(createdPermission.id);
            expect(result).toHaveProperty('code');
            expect(result.code).toBe(createdPermission.code);
        });
    });

    describe('[method]: #create', () => {
        it('deve lançar AppError 409 quando tentar criar uma nova permissão com code já existente.', async () => {
            await permissionsRepository.create({
                code: 'permissions:create',
                description: 'Criar permissões',
            });
            const createPermissionDTO: CreatePermissionDTO = {
                code: 'permissions:create',
                description: 'teste de descrição.',
            };

            await expect(permissionsService.create(createPermissionDTO)).rejects.toBeInstanceOf(AppError);
            await expect(permissionsService.create(createPermissionDTO)).rejects.toMatchObject({
                statusCode: 409,
                message: 'Já existe uma permissão vinculada a esse code.',
            });
        });

        it('deve retornar a permissão ao ser criada com sucesos.', async () => {
            const createPermissionDTO: CreatePermissionDTO = {
                code: 'permissions:create',
                description: 'teste de descrição.',
            };

            const createdPermission = await permissionsService.create(createPermissionDTO);

            expect(createdPermission).toBeTypeOf('object');
            expect(createdPermission).not.toBeNull();
            expect(createdPermission).toHaveProperty('code');
            expect(createdPermission.code).toBe(createPermissionDTO.code);
        });
    });

    describe('[method]: #update', () => {
        it('deve lançar AppError 400 quando for enviado um objeto vazio para atualização.', async () => {
            await expect(permissionsService.update('', {})).rejects.toBeInstanceOf(AppError);
            await expect(permissionsService.update('', {})).rejects.toMatchObject({
                statusCode: 400,
                message: 'Nenhum campo foi enviado para atualização.',
            });
        });

        it('deve lançar AppError 404 quando tentar atualizar uma permissão que não existe.', async () => {
            const updatePermissionDTO: UpdatePermissionDTO = {
                code: 'permissions:create',
                description: 'teste de descrição.',
            };

            const nonExistentId = 'id-inexistente';

            await expect(permissionsService.update(nonExistentId, updatePermissionDTO)).rejects.toBeInstanceOf(AppError);
            await expect(permissionsService.update(nonExistentId, updatePermissionDTO)).rejects.toMatchObject({
                statusCode: 404,
                message: 'Permissão não encontrada em nossa base de dados.',
            });
        });

        it('deve retornar a própria permissão sem chamar o método update do repositório quando os dados não forem diferentes.', async () => {
            const createdPermission = await permissionsRepository.create({
                code: 'permissions:create',
                description: 'Criar permissões',
            });
            const updatePermissionDTO: UpdatePermissionDTO = {
                code: 'permissions:create',
                description: 'Criar permissões',
            };

            const spyUpdate = vi.spyOn(permissionsRepository, 'update');
            const updatedPermission = await permissionsService.update(createdPermission.id, updatePermissionDTO);

            expect(updatedPermission).toMatchObject({
                id: createdPermission.id,
                code: createdPermission.code,
                description: createdPermission.description,
            });
            expect(spyUpdate).not.toHaveBeenCalled();
        });

        it('deve lançar AppError 409 quando o novo code já pertence a outra permissão.', async () => {
            await permissionsRepository.create({
                code: 'permissions:create',
                description: 'Criar permissões',
            });

            const toBeChangedPermission = await permissionsRepository.create({
                code: 'permissions:update',
                description: 'Ataulizar permissões',
            });

            await expect(permissionsService.update(toBeChangedPermission.id, { code: 'permissions:create' })).rejects.toBeInstanceOf(AppError);
            await expect(permissionsService.update(toBeChangedPermission.id, { code: 'permissions:create' })).rejects.toMatchObject({
                statusCode: 409,
                message: 'Já existe outra permissão vinculada a esse code.',
            });
        });

        it('atualiza as propriedades da permissão e mantém o code inalterado quando esse não é alterado.', async () => {
            const createdPermission = await permissionsRepository.create({
                code: 'permissions:create',
                description: 'Criar permissões',
            });

            const updatedPermission = await permissionsService.update(createdPermission.id, { description: 'Criador de permissões' });

            expect(updatedPermission).toBeTypeOf('object');
            expect(updatedPermission).not.toBeNull();
            expect(updatedPermission?.code).toBe(createdPermission.code);
            expect(updatedPermission?.description).toBe('Criador de permissões');
        });

        it('atualiza a permissão quando todos os dados mudarem.', async () => {
            const createdPermission = await permissionsRepository.create({
                code: 'permissions:create',
                description: 'Criar permissões',
            });

            const updatedPermission = await permissionsService.update(createdPermission.id, { code: 'permissions:update', description: 'Atualiza permissão' });

            expect(updatedPermission).toBeTypeOf('object');
            expect(updatedPermission).not.toBeNull();
            expect(updatedPermission).toHaveProperty('code');
            expect(updatedPermission.code).toBe('permissions:update');
            expect(updatedPermission).toHaveProperty('description');
            expect(updatedPermission.description).toBe('Atualiza permissão');
        });
    });

    describe('[method]: #delete', () => {
        it('deve lançar AppError 404 quando tenta deletar um id que não existe', async () => {
            await expect(permissionsService.delete('id-inexistente')).rejects.toBeInstanceOf(AppError);
            await expect(permissionsService.delete('id-inexistente')).rejects.toMatchObject({
                statusCode: 404,
                message: 'Permissão não encontrada em nossa base de dados.',
            });
        });

        it('não deve conseguir retornar informações do registro quando for deletado', async () => {
            const createdPermission = await permissionsRepository.create({
                code: 'permissions:create',
                description: 'Criar permissões',
            });

            const spyDelete = vi.spyOn(permissionsRepository, 'delete');
            await permissionsService.delete(createdPermission.id);

            expect(spyDelete).toHaveBeenCalled();
            await expect(permissionsService.show(createdPermission.id)).rejects.toBeInstanceOf(AppError);
            await expect(permissionsService.show(createdPermission.id)).rejects.toMatchObject({
                statusCode: 404,
                message: 'Permissão não encontrada em nossa base de dados.',
            });
        });
    });
});
