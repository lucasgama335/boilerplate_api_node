/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { IUserPermissionsService } from '@/app/services/user-permissions/UserPermissionsService';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DepartmentsService } from '../departments.service';
import { UpdateDepartmentDTO } from '../types/departments.types';
import { InMemoryDepartmentsRepository } from './repositories/in-memory-departments.repository';

describe('[UNIT TEST]: Módulo de Departamentos - Service', () => {
    let departmentsRepository: InMemoryDepartmentsRepository;
    let mockUserPermissionsService: IUserPermissionsService;

    let departmentsService: DepartmentsService;

    beforeEach(() => {
        mockUserPermissionsService = {
            getPermissions: vi.fn(),
            invalidatePermissionsByDepartment: vi.fn(),
            invalidatePermissionsByPermission: vi.fn(),
            invalidatePermissions: vi.fn(),
        };

        departmentsRepository = new InMemoryDepartmentsRepository();
        departmentsService = new DepartmentsService(departmentsRepository, mockUserPermissionsService);
    });

    describe('[method]: #list', () => {
        it('deve retornar uma lista vazia e total 0 quando não houver departamentos cadastrados', async () => {
            const page = 1;
            const limit = 10;

            const result = await departmentsService.list(page, limit);

            expect(result.departments).toEqual([]);
            expect(result).toHaveProperty('meta.total');
            expect(result.meta.total).toBe(0);
        });

        it('deve paginar os departamentos corretamente respeitando o limite e o total de registros', async () => {
            const page = 1;
            const limit = 2;

            await departmentsRepository.create({ name: 'RH', description: 'Recursos Humanos' });
            await departmentsRepository.create({ name: 'TI', description: 'Tecnologia da Informação' });
            await departmentsRepository.create({ name: 'Financeiro', description: 'Área Financeira' });

            const result = await departmentsService.list(page, limit);

            expect(result.departments).toHaveLength(2);
            expect(result).toHaveProperty('meta.total');
            expect(result.meta.total).toBe(3);
        });

        it('deve retornar a página correta quando houver múltiplos registros e paginação avançada', async () => {
            const page = 2;
            const limit = 2;

            await departmentsRepository.create({ name: 'RH', description: 'Recursos Humanos' });
            await departmentsRepository.create({ name: 'TI', description: 'Tecnologia da Informação' });
            await departmentsRepository.create({ name: 'Financeiro', description: 'Área Financeira' });

            const result = await departmentsService.list(page, limit);

            expect(result.departments).toHaveLength(1);
            expect(result.departments[0].name).toBe('RH');
            expect(result).toHaveProperty('meta.total');
            expect(result.meta.total).toBe(3);
        });

        it('deve retornar os departamentos sem as permissões por padrão ou quando withPermissions for falso', async () => {
            await departmentsRepository.create({
                name: 'TI',
                description: 'Tecnologia',
                permissions: ['perm-1'],
            });

            const resultWithoutFlag = await departmentsService.list(1, 10);
            const resultWithFalseFlag = await departmentsService.list(1, 10, false);

            expect(resultWithoutFlag.departments[0]).not.toHaveProperty('permissions');
            expect(resultWithFalseFlag.departments[0]).not.toHaveProperty('permissions');
        });

        it('deve retornar os departamentos acompanhados de suas permissões quando withPermissions for verdadeiro', async () => {
            await departmentsRepository.create({
                name: 'TI',
                description: 'Tecnologia',
                permissions: ['perm-1'],
            });

            const result = await departmentsService.list(1, 10, true);

            expect(result.departments[0]).toHaveProperty('permissions');
            expect((result.departments[0] as any).permissions).toHaveLength(1);
            expect((result.departments[0] as any).permissions[0].id).toBe('perm-1');
        });

        it('deve filtrar os departamentos pelo nome ignorando maiúsculas e minúsculas', async () => {
            await departmentsRepository.create({ name: 'Recursos Humanos' });
            await departmentsRepository.create({ name: 'Tecnologia' });
            await departmentsRepository.create({ name: 'Tecnologia da Informação' });

            // Buscando por "tecno" (minúsculo)
            const result = await departmentsService.list(1, 10, false, { name: 'tecno' });

            expect(result.departments).toHaveLength(2); // TI e Tecnologia da Informação
            expect(result.meta.total).toBe(2);
        });

        it('deve filtrar os departamentos por intervalo de data de criação', async () => {
            vi.useFakeTimers();

            vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
            await departmentsRepository.create({ name: 'RH' });

            vi.setSystemTime(new Date('2026-06-01T10:00:00.000Z'));
            await departmentsRepository.create({ name: 'TI' });

            vi.setSystemTime(new Date('2026-12-01T10:00:00.000Z'));
            await departmentsRepository.create({ name: 'Financeiro' });

            vi.useRealTimers();

            // Filtrando apenas os que foram criados de Fevereiro a Novembro de 2026
            const filters = {
                startDate: new Date('2026-02-01T00:00:00.000Z'),
                endDate: new Date('2026-11-30T23:59:59.000Z'),
            };

            const result = await departmentsService.list(1, 10, false, filters);

            expect(result.departments).toHaveLength(1);
            expect(result.departments[0].name).toBe('TI');
            expect(result.meta.total).toBe(1);
        });

        it('deve recalcular o totalPages corretamente quando um filtro é aplicado', async () => {
            await departmentsRepository.create({ name: 'TI Suporte' });
            await departmentsRepository.create({ name: 'TI Infraestrutura' });
            await departmentsRepository.create({ name: 'TI Desenvolvimento' });
            await departmentsRepository.create({ name: 'RH' });
            await departmentsRepository.create({ name: 'Financeiro' });

            // Buscando por "TI" com limite de 2 por página.
            // Como existem 3 "TI"s, o totalPages deve ser 2 (duas páginas para caber os 3 resultados).
            const result = await departmentsService.list(1, 2, false, { name: 'TI' });

            expect(result.meta.total).toBe(3);
            expect(result.meta.totalPages).toBe(2);
            expect(result.departments).toHaveLength(2); // Traz apenas 2 por causa do limite
        });
    });

    describe('[method]: #create', () => {
        it('deve lançar AppError 409 quando tentar criar um departamento com um nome já existente', async () => {
            await departmentsRepository.create({
                name: 'Tecnologia',
                description: 'Setor de TI',
            });

            const createDTO = {
                name: 'Tecnologia',
                description: 'Novo setor de TI',
            };

            await expect(departmentsService.create(createDTO)).rejects.toBeInstanceOf(AppError);
            await expect(departmentsService.create(createDTO)).rejects.toMatchObject({
                statusCode: 409,
                message: 'Já existe um departamento vinculado a esse nome.',
            });
        });

        it('deve lançar AppError 400 se alguma das permissões informadas não existir', async () => {
            // Populamos apenas uma permissão válida, deixando a outra ausente
            departmentsRepository.validPermissionIds = new Set(['perm-1']);

            const createDTO = {
                name: 'Financeiro',
                description: 'Setor Financeiro',
                permissions: ['perm-1', 'perm-999'], // 'perm999' não existe
            };

            await expect(departmentsService.create(createDTO)).rejects.toMatchObject({
                statusCode: 400,
                message: 'Um ou mais IDs de permissão informados são inválidos ou não existem.',
            });
        });

        it('deve criar o departamento com sucesso quando os dados forem válidos', async () => {
            const createDTO = {
                name: 'Recursos Humanos',
                description: 'Setor de RH',
            };

            const result = await departmentsService.create(createDTO);

            expect(result).toHaveProperty('id');
            expect(result.name).toBe('Recursos Humanos');
            expect(result.description).toBe('Setor de RH');
        });
    });

    describe('[method]: #update', () => {
        it('deve retornar AppError 400 se for enviado um objeto vazio', async () => {
            const createdDepartment = await departmentsService.create({
                name: 'departamento-teste',
                description: 'descrição de teste',
                createdById: '123-456',
            });

            await expect(departmentsService.update(createdDepartment.id, {})).rejects.toBeInstanceOf(AppError);
            await expect(departmentsService.update(createdDepartment.id, {})).rejects.toMatchObject({
                statusCode: 400,
                message: 'Nenhum campo foi enviado para atualização.',
            });
        });

        it('deve retornar AppError 404 se o departamento informado for inexistente', async () => {
            await expect(departmentsService.update('123-456', { description: 'teste' })).rejects.toBeInstanceOf(AppError);
            await expect(departmentsService.update('123-456', { description: 'teste' })).rejects.toMatchObject({
                statusCode: 404,
                message: 'Departamento não encontrado em nossa base de dados.',
            });
        });

        it('deve retornar AppError 400 se houver alguma permissão que não exista', async () => {
            departmentsRepository.validPermissionIds = new Set(['perm-1']);
            const createdDepartment = await departmentsService.create({
                name: 'departamento-teste',
                description: 'descrição de teste',
                createdById: '123-456',
            });

            await expect(departmentsService.update(createdDepartment.id, { permissions: ['perm-1', 'perm-2'] })).rejects.toBeInstanceOf(AppError);
            await expect(departmentsService.update(createdDepartment.id, { permissions: ['perm-1', 'perm-2'] })).rejects.toMatchObject({
                statusCode: 400,
                message: 'Um ou mais IDs de permissão informados são inválidos ou não existem.',
            });
        });

        it('deve retornar o próprio departamento caso as alterações enviadas sejam iguais a já cadastradas no banco', async () => {
            const createdDepartment = await departmentsRepository.create({
                name: 'departamento-1',
                description: 'description test',
            });
            const updatePermissionDTO: UpdateDepartmentDTO = {
                name: 'departamento-1',
                description: 'description test',
            };

            const spyUpdate = vi.spyOn(departmentsRepository, 'update');
            const updatedDepartment = await departmentsService.update(createdDepartment.id, updatePermissionDTO);

            expect(updatedDepartment).toMatchObject({
                id: createdDepartment.id,
                name: createdDepartment.name,
                description: createdDepartment.description,
            });
            expect(spyUpdate).not.toHaveBeenCalled();
        });

        it('deve retornar AppError 409 se for alterado o nome do departamento para um nome que já esteja cadastrado em outro departamento', async () => {
            await departmentsRepository.create({
                name: 'departamento-1',
                description: 'description test',
            });
            const createdDepartment2 = await departmentsRepository.create({
                name: 'departamento-3',
                description: 'description test 2',
            });

            await expect(departmentsService.update(createdDepartment2.id, { name: 'departamento-1' })).rejects.toBeInstanceOf(AppError);
            await expect(departmentsService.update(createdDepartment2.id, { name: 'departamento-1' })).rejects.toMatchObject({
                statusCode: 409,
                message: 'Já existe outro departamento vinculado a esse nome.',
            });
        });

        it('deve verificar se o método invalidatePermissionsByDepartment foi chamado para invalidar as permissões globais após atualizar um departamento somente se houver alteração de permissões', async () => {
            const createdDepartment = await departmentsRepository.create({
                name: 'departamento-3',
                description: 'description test 2',
            });

            vi.spyOn(departmentsRepository, 'checkPermissionsExist').mockResolvedValue(true);
            await departmentsService.update(createdDepartment.id, { permissions: ['test-1'] });

            expect(mockUserPermissionsService.invalidatePermissionsByDepartment).toHaveBeenCalled();
        });

        it('deve verificar se o método invalidatePermissionsByDepartment não foi chamado para invalidar as permissões globais após atualizar um departamento somente se não houver alteração de permissões', async () => {
            const createdDepartment = await departmentsRepository.create({
                name: 'departamento-3',
                description: 'description test 2',
            });

            await departmentsService.update(createdDepartment.id, { name: 'departamento-1' });

            expect(mockUserPermissionsService.invalidatePermissionsByDepartment).not.toHaveBeenCalled();
        });

        it('deve retornar um objeto com o departamento atualizado', async () => {
            const createdDepartment = await departmentsRepository.create({
                name: 'departamento-3',
                description: 'description test 2',
            });

            const result = await departmentsService.update(createdDepartment.id, { name: 'departamento-1' });

            expect(result).toBeTypeOf('object');
            expect(result).not.toBeNull();
            expect(result.name).toBe('departamento-1');
        });
    });

    describe('[method]: #delete', () => {
        it('deve retornar AppError 404 se o departamento informado for inexistente', async () => {
            await expect(departmentsService.delete('123-456')).rejects.toBeInstanceOf(AppError);
            await expect(departmentsService.delete('123-456')).rejects.toMatchObject({
                statusCode: 404,
                message: 'Departamento não encontrado em nossa base de dados.',
            });
        });

        it('deve verificar se o método invalidatePermissionsByDepartment foi chamado para invalidar as permissões globais após deletar um departamento', async () => {
            const createdDepartment = await departmentsRepository.create({
                name: 'departamento-3',
                description: 'description test 2',
            });

            await departmentsService.delete(createdDepartment.id);

            expect(mockUserPermissionsService.invalidatePermissionsByDepartment).toHaveBeenCalled();
        });

        it('deve verificar se o departamento foi deletado', async () => {
            const createdDepartment = await departmentsRepository.create({
                name: 'departamento-3',
                description: 'description test 2',
            });

            await departmentsService.delete(createdDepartment.id);

            await expect(departmentsService.show(createdDepartment.id)).rejects.toBeInstanceOf(AppError);
            await expect(departmentsService.show(createdDepartment.id)).rejects.toMatchObject({
                statusCode: 404,
                message: 'Departamento não encontrado em nossa base de dados.',
            });
        });
    });
});
