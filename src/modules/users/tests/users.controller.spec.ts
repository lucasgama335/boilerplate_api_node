/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersController } from '../users.controller';

describe('Users Controller (Unit Test)', () => {
    let mockUserService: any;
    let usersController: UsersController;

    let req: Partial<Request>;
    let res: Partial<Response>;

    beforeEach(() => {
        mockUserService = {
            registerUser: vi.fn(),
            getProfile: vi.fn(),
            confirmEmail: vi.fn(),
            resendConfirmEmail: vi.fn(),
        };

        usersController = new UsersController(mockUserService);
        vi.clearAllMocks();

        req = {
            body: {},
            user: undefined,
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        };
    });

    describe('registerUser', () => {
        it('deve extrair os dados do body, repassar ao service e retornar 201 com o usuário', async () => {
            const userData = {
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                password: 'SecurePassword!123',
                passwordConfirmation: 'SecurePassword!123',
            };
            req.body = userData;

            const expectedUserReturn = {
                id: 'uuid-123',
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
            };

            mockUserService.registerUser.mockResolvedValue(expectedUserReturn);

            await usersController.registerUser(req as Request, res as Response);

            expect(mockUserService.registerUser).toHaveBeenCalledWith(userData);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expectedUserReturn);
        });
    });

    describe('showProfile', () => {
        it('deve extrair o ID do usuário do token (req.user), buscar o perfil e retornar 200', async () => {
            req.user = { id: 'uuid-456' };

            const expectedProfile = {
                id: 'uuid-456',
                firstName: 'John',
                lastName: 'Smith',
                email: 'john@example.com',
            };

            mockUserService.getProfile.mockResolvedValue(expectedProfile);

            await usersController.showProfile(req as Request, res as Response);

            expect(mockUserService.getProfile).toHaveBeenCalledWith('uuid-456');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expectedProfile);
        });
    });

    describe('confirmEmail', () => {
        it('deve chamar o service com o token e retornar status 200', async () => {
            req.body = { token: 'valid-jwt-token' };
            mockUserService.confirmEmail.mockResolvedValue(undefined);

            await usersController.confirmEmail(req as Request, res as Response);

            expect(mockUserService.confirmEmail).toHaveBeenCalledWith('valid-jwt-token');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'E-mail confirmado com sucesso.' });
        });
    });

    describe('resendConfirmationEmail', () => {
        it('deve chamar o service com o e-mail e retornar status 200', async () => {
            req.body = { email: 'john@example.com' };
            mockUserService.resendConfirmEmail.mockResolvedValue(undefined);

            await usersController.resendConfirmationEmail(req as Request, res as Response);

            expect(mockUserService.resendConfirmEmail).toHaveBeenCalledWith('john@example.com');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ message: 'Um novo e-mail de confirmação foi enviado para o endereço informado.' });
        });
    });
});
