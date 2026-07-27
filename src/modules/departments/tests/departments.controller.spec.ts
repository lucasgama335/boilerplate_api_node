/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DepartmentsController } from '../departments.controller';
import { DepartmentsService } from '../departments.service';

describe('[UNIT TEST]: Módulo de Departamentos - Controller', () => {
    let departmentsController: DepartmentsController;

    let mockDepartmentsService: any;

    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockDepartmentsService = {
            list: vi.fn(),
            show: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        };

        departmentsController = new DepartmentsController(mockDepartmentsService as DepartmentsService);

        mockReq = {
            query: {},
            params: {},
            body: {},
            user: { id: '456-789' } as any,
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
    });

    describe('[method]: #list', () => {
        it('deve converter page e limit da query string para número, antes de chamar o service', async () => {
            mockReq.query = { page: '2', limit: '15' };
            mockDepartmentsService.list.mockResolvedValue({ departments: [], total: 0 });

            await departmentsController.list(mockReq as Request, mockRes as Response);

            expect(mockDepartmentsService.list).toHaveBeenCalledWith(2, 15);
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });
    });

    describe('[method]: #show', () => {
        it('deve converter id para um número, retornar status 200 e o corpo contendo o departamento achado', async () => {
            mockReq.params = { id: '123' };

            const fakeFoundedDepartment = { name: 'teste departamento', description: 'teste de descrição' };
            mockDepartmentsService.show.mockResolvedValue(fakeFoundedDepartment);

            await departmentsController.show(mockReq as Request, mockRes as Response);

            expect(mockDepartmentsService.show).toHaveBeenCalledWith('123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ department: fakeFoundedDepartment });
        });

        it('deve retornar status 200 e o corpo contendo o departamento achado mesmo que o params.id venha como array, pois somente o primeiro id será extraído', async () => {
            mockReq.params = { id: ['123', '563'] };

            const fakeFoundedDepartment = { name: 'teste departamento', description: 'teste de descrição' };
            mockDepartmentsService.show.mockResolvedValue(fakeFoundedDepartment);

            await departmentsController.show(mockReq as Request, mockRes as Response);

            expect(mockDepartmentsService.show).toHaveBeenCalledWith('123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ department: fakeFoundedDepartment });
        });
    });

    describe('[method]: #create', () => {
        it('deve retornar status 201 e o corpo contendo o departamento criado', async () => {
            mockReq.params = { id: '123' };
            mockReq.body = { name: 'teste departamento', description: 'teste de descrição', createdById: '456-789' };

            const fakeFoundedDepartment = { id: '123', name: 'teste departamento', description: 'teste de descrição' };
            mockDepartmentsService.create.mockResolvedValue(fakeFoundedDepartment);

            await departmentsController.create(mockReq as Request, mockRes as Response);

            expect(mockDepartmentsService.create).toHaveBeenCalledWith(mockReq.body);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({ department: fakeFoundedDepartment });
        });
    });

    describe('[method]: #update', () => {
        it('deve retornar status 200 e o corpo contendo o departamento com os dados atualizados', async () => {
            mockReq.params = { id: '123-456' };
            mockReq.body = { name: 'teste departamento', description: 'teste de descrição' };

            const fakeFoundedDepartment = { id: '123-987', name: 'teste departamento 2', description: 'teste de descrição 2', updatedById: '456-789' };
            mockDepartmentsService.update.mockResolvedValue(fakeFoundedDepartment);

            await departmentsController.update(mockReq as Request, mockRes as Response);

            expect(mockDepartmentsService.update).toHaveBeenCalledWith('123-456', {
                ...mockReq.body,
                updatedById: '456-789',
            });
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ department: fakeFoundedDepartment });
        });
    });

    describe('[method]: #delete', () => {
        it('deve retornar status 200 quando o departamento for deletado', async () => {
            mockReq.params = { id: '123' };

            await departmentsController.delete(mockReq as Request, mockRes as Response);

            expect(mockDepartmentsService.delete).toHaveBeenCalledWith('123');
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({});
        });
    });
});
