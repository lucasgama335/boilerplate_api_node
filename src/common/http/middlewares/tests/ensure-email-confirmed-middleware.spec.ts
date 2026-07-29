/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureEmailConfirmedMiddleware } from '../ensure-email-confirmed-middleware';

describe('[UNIT TEST]: Middleware - Ensure Email Confirmed', () => {
    let mockUsersRepository: any;
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: any;

    beforeEach(() => {
        mockUsersRepository = {
            findById: vi.fn(),
        };
        mockReq = {
            user: { id: 'user-123' } as any,
        };
        mockRes = {};
        nextFunction = vi.fn();
    });

    it('deve lançar AppError 401 se req.user não existir', async () => {
        mockReq.user = undefined;
        const middleware = ensureEmailConfirmedMiddleware(mockUsersRepository);

        await expect(middleware(mockReq as Request, mockRes as Response, nextFunction)).rejects.toMatchObject({
            statusCode: 401,
            message: 'Token JWT não informado ou inválido.',
        });
    });

    it('deve lançar AppError 404 se o usuário não for encontrado no banco de dados', async () => {
        mockUsersRepository.findById.mockResolvedValue(null);
        const middleware = ensureEmailConfirmedMiddleware(mockUsersRepository);

        await expect(middleware(mockReq as Request, mockRes as Response, nextFunction)).rejects.toMatchObject({
            statusCode: 404,
            message: 'Usuário não encontrado.',
        });
    });

    it('deve lançar AppError 403 se isEmailConfirmed for false', async () => {
        mockUsersRepository.findById.mockResolvedValue({ id: 'user-123', isEmailConfirmed: false });
        const middleware = ensureEmailConfirmedMiddleware(mockUsersRepository);

        await expect(middleware(mockReq as Request, mockRes as Response, nextFunction)).rejects.toMatchObject({
            statusCode: 403,
            message: 'Acesso negado. Por favor, confirme seu e-mail para realizar esta ação.',
        });
    });

    it('deve chamar next() se o e-mail do usuário estiver confirmado', async () => {
        mockUsersRepository.findById.mockResolvedValue({ id: 'user-123', isEmailConfirmed: true });
        const middleware = ensureEmailConfirmedMiddleware(mockUsersRepository);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledOnce();
    });
});
