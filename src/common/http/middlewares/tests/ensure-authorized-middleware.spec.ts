/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAuthorizedMiddleware } from '../ensure-authorized-middleware';

describe('[UNIT TEST]: Middleware - Ensure Authorized', () => {
    let mockPermissionsService: any;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: any;

    beforeEach(() => {
        mockPermissionsService = {
            getPermissions: vi.fn(),
        };
        mockReq = {
            user: { id: 'user-123' } as any,
        };
        mockRes = {};
        nextFunction = vi.fn();
    });

    it('deve lançar AppError 401 (fallback) se o objeto req.user não existir', async () => {
        mockReq.user = undefined; // Desenvolvedor esqueceu de colocar o authMiddleware antes
        const middleware = ensureAuthorizedMiddleware(mockPermissionsService, ['users:create']);

        await expect(middleware(mockReq as Request, mockRes as Response, nextFunction)).rejects.toMatchObject({
            statusCode: 401,
            message: 'Usuário não autenticado.',
        });
    });

    it('deve chamar next() imediatamente e pular o banco se o array de permissões exigidas for vazio', async () => {
        const middleware = ensureAuthorizedMiddleware(mockPermissionsService, []);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockPermissionsService.getPermissions).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledOnce();
    });

    it('deve chamar next() permitindo o acesso se o usuário possuir o curinga de Super Admin (*)', async () => {
        mockPermissionsService.getPermissions.mockResolvedValue(['users:read', '*']); // Possui curinga
        const middleware = ensureAuthorizedMiddleware(mockPermissionsService, ['users:create', 'departments:delete']);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockPermissionsService.getPermissions).toHaveBeenCalledWith('user-123');
        expect(nextFunction).toHaveBeenCalledOnce();
    });

    it('deve lançar AppError 403 se o usuário NÃO possuir TODAS as permissões exigidas', async () => {
        mockPermissionsService.getPermissions.mockResolvedValue(['users:create']); // Tem uma, mas falta a outra
        const middleware = ensureAuthorizedMiddleware(mockPermissionsService, ['users:create', 'users:update']);

        await expect(middleware(mockReq as Request, mockRes as Response, nextFunction)).rejects.toMatchObject({
            statusCode: 403,
            message: 'Acesso negado. Você não possui permissão para realizar esta ação.',
        });
        expect(nextFunction).not.toHaveBeenCalled();
    });

    it('deve chamar next() se o usuário possuir TODAS as permissões exigidas', async () => {
        mockPermissionsService.getPermissions.mockResolvedValue(['users:create', 'users:update', 'departments:read']);
        const middleware = ensureAuthorizedMiddleware(mockPermissionsService, ['users:create', 'users:update']);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledOnce();
    });
});
