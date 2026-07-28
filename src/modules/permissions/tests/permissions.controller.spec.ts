/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsController } from '../permissions.controller';
import { PermissionsService } from '../permissions.service';

describe('[UNIT TEST]: Módulo de Permissões - Controller', () => {
    let permissionsController: PermissionsController;

    let mockPermissionsService: any;

    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockPermissionsService = {
            list: vi.fn(),
            show: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        };

        permissionsController = new PermissionsController(mockPermissionsService as PermissionsService);

        mockReq = {
            query: {},
            params: {},
            body: {},
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
    });

    describe('[method]: #list', () => {
        it('deve repassar os parâmetros de paginação e filtros extraídos pelo Zod para o service', async () => {
            // Simulamos o objeto req.query JÁ tipado e convertido pelo middleware do Zod
            mockReq.query = { page: 2 as any, limit: 10 as any };
            mockPermissionsService.list.mockResolvedValue({ permissions: [], total: 0 });

            await permissionsController.list(mockReq as Request, mockRes as Response);

            // O service agora espera: page, limit, e o objeto de filtros
            expect(mockPermissionsService.list).toHaveBeenCalledWith(2, 10, {
                code: undefined,
                startDate: undefined,
                endDate: undefined,
            });
        });
    });

    describe('[method]: #show', () => {
        it('deve converter id para um número, retornar status 200 e o corpo contendo a permissão achada', async () => {
            mockReq.params = { id: '123' };

            const fakeFoundedPermission = { id: '123', code: 'users:create', description: 'Teste' };
            mockPermissionsService.show.mockResolvedValue(fakeFoundedPermission);

            await permissionsController.show(mockReq as Request, mockRes as Response);

            expect(mockPermissionsService.show).toHaveBeenCalledWith('123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ permission: fakeFoundedPermission });
        });
    });

    describe('[method]: #create', () => {
        it('deve retornar status 201 e o corpo contendo a permissão criada', async () => {
            mockReq.params = { id: '123' };
            mockReq.body = { code: 'users:create', description: 'Teste 2' };

            const fakeUpdatedPermission = { id: '123', code: 'users:create', description: 'Teste 2' };
            mockPermissionsService.create.mockResolvedValue(fakeUpdatedPermission);

            await permissionsController.create(mockReq as Request, mockRes as Response);

            expect(mockPermissionsService.create).toHaveBeenCalledWith(mockReq.body);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({ permission: fakeUpdatedPermission });
        });
    });

    describe('[method]: #update', () => {
        it('deve retornar status 200 e o corpo contendo a permissão com os dados atualizados', async () => {
            mockReq.params = { id: '123' };
            mockReq.body = { code: 'users:create', description: 'Teste 2' };

            const fakeUpdatedPermission = { id: '123', code: 'users:create', description: 'Teste 2' };
            mockPermissionsService.update.mockResolvedValue(fakeUpdatedPermission);

            await permissionsController.update(mockReq as Request, mockRes as Response);

            expect(mockPermissionsService.update).toHaveBeenCalledWith('123', mockReq.body);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ permission: fakeUpdatedPermission });
        });
    });

    describe('[method]: #delete', () => {
        it('deve retornar status 200 quando a permissão for deletada', async () => {
            mockReq.params = { id: '123' };

            await permissionsController.delete(mockReq as Request, mockRes as Response);

            expect(mockPermissionsService.delete).toHaveBeenCalledWith('123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({});
        });
    });
});
