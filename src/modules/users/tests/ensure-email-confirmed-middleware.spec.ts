/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { ensureEmailConfirmedMiddleware } from '@/app/http/middlewares/ensure-email-confirmed-middleware';
import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Ensure Email Confirmed Middleware', () => {
    let mockUserRepository: any;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    let middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;

    beforeEach(() => {
        mockUserRepository = {
            findById: vi.fn(),
        };

        req = {
            user: { id: 'user-123' },
        };
        res = {};
        next = vi.fn();

        middleware = ensureEmailConfirmedMiddleware(mockUserRepository);
    });

    it('deve lançar erro 401 se o ID do usuário não estiver presente na requisição', async () => {
        req.user = undefined as any;

        await expect(middleware(req as Request, res as Response, next)).rejects.toMatchObject(new AppError('Token JWT não informado ou inválido.', 401));

        expect(next).not.toHaveBeenCalled();
    });

    it('deve lançar erro 404 se o usuário não for encontrado no banco de dados', async () => {
        mockUserRepository.findById.mockResolvedValue(null);

        await expect(middleware(req as Request, res as Response, next)).rejects.toMatchObject(new AppError('Usuário não encontrado.', 404));

        expect(next).not.toHaveBeenCalled();
    });

    it('deve lançar erro 403 se o e-mail do usuário não estiver confirmado', async () => {
        mockUserRepository.findById.mockResolvedValue({
            id: 'user-123',
            isEmailConfirmed: false,
        });

        await expect(middleware(req as Request, res as Response, next)).rejects.toMatchObject(
            new AppError('Acesso negado. Por favor, confirme seu e-mail para realizar esta ação.', 403),
        );

        expect(next).not.toHaveBeenCalled();
    });

    it('deve chamar next() com sucesso se o e-mail do usuário estiver confirmado', async () => {
        mockUserRepository.findById.mockResolvedValue({
            id: 'user-123',
            isEmailConfirmed: true,
        });

        await middleware(req as Request, res as Response, next);

        expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
        expect(next).toHaveBeenCalledTimes(1);
    });
});
