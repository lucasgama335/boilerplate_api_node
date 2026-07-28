/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAccessController } from '../user-access.controller';
import { UserAccessService } from '../user-access.service';

describe('[UNIT TEST]: Módulo de User Access - Controller', () => {
    let userAccessController: UserAccessController;
    let mockUserAccessService: any;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockUserAccessService = {
            setUserPermissions: vi.fn(),
        };

        userAccessController = new UserAccessController(mockUserAccessService as UserAccessService);

        mockReq = {
            params: {},
            body: {},
            // Simulamos o usuário logado (Admin) concedendo as permissões
            user: { id: 'admin-123' } as any,
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };
    });

    describe('[method]: #create', () => {
        it('deve extrair id da URL, permissions do body e grantedById do req.user e retornar 201', async () => {
            mockReq.params = { id: 'user-777' };
            mockReq.body = { permissions: ['perm-1', 'perm-2'] };

            const fakeResponseUser = { id: 'user-777', permissions: [] };
            mockUserAccessService.setUserPermissions.mockResolvedValue(fakeResponseUser);

            // O terceiro parâmetro (next) não é usado aqui, então passamos um vi.fn()
            await userAccessController.create(mockReq as Request, mockRes as Response, vi.fn());

            // Garante que o ID do admin que executou a ação foi repassado corretamente
            expect(mockUserAccessService.setUserPermissions).toHaveBeenCalledWith('user-777', ['perm-1', 'perm-2'], 'admin-123');
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({ user: fakeResponseUser });
        });
    });
});
