/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersController } from '../users.controller';
import { UserService } from '../users.service';
import { makeCreateUser, makeCreateUserDTO } from './factories/users.factory';

describe('[UNIT TEST]: Módulo de Usuários - Controller', () => {
    let usersController: UsersController;

    let mockUsersService: any;

    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        mockUsersService = {
            getProfile: vi.fn(),
            registerUser: vi.fn(),
            confirmEmail: vi.fn(),
            resendConfirmEmail: vi.fn(),
        };

        usersController = new UsersController(mockUsersService as UserService);

        mockReq = {
            query: {},
            params: {},
            body: {},
            user: { id: 'user-123' } as any,
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            send: vi.fn(),
        };
    });

    describe('[method]: #registerUser', () => {
        it('deve retornar o usuário criado', async () => {
            mockReq.body = { firstName: 'John', lastName: 'Doe', email: 'example@gmail.com', password: 'confirm@Password123', paswwordConfirmation: 'confirm@Password123' };

            const fakeUser = makeCreateUserDTO();
            mockUsersService.registerUser.mockResolvedValue(fakeUser);

            await usersController.registerUser(mockReq as Request, mockRes as Response);

            expect(mockUsersService.registerUser).toHaveBeenCalledWith(mockReq.body);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(fakeUser);
        });
    });

    describe('[method]: #getProfile', () => {
        it('deve retornar status 200 e o perfil do usuário logado', async () => {
            const fakeProfile = makeCreateUser({ id: 'user-123' });
            mockUsersService.getProfile.mockResolvedValue(fakeProfile);

            await usersController.showProfile(mockReq as Request, mockRes as Response);

            expect(mockUsersService.getProfile).toHaveBeenCalledWith(fakeProfile.id);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(fakeProfile);
        });
    });

    describe('[method]: #show', () => {
        it('deve extrair o id da rota, retornar status 200 e o corpo contendo o usuário achado', async () => {
            const fakeUser = makeCreateUser();

            mockReq.params = { id: fakeUser.id as string };
            mockUsersService.getProfile.mockResolvedValue(fakeUser);

            await usersController.show(mockReq as Request, mockRes as Response);

            expect(mockUsersService.getProfile).toHaveBeenCalledWith(fakeUser.id);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(fakeUser);
        });
    });

    describe('[method]: #confirmEmail', () => {
        it('deve retornar status 200 e uma mensagem de sucesso após validar o token', async () => {
            mockReq.body = { token: '798456-asfsafaf' };

            mockUsersService.confirmEmail.mockResolvedValue();
            await usersController.confirmEmail(mockReq as Request, mockRes as Response);

            expect(mockUsersService.confirmEmail).toHaveBeenCalledWith(mockReq.body?.token);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'E-mail confirmado com sucesso.' });
        });
    });

    describe('[method]: #resendConfirmationEmail', () => {
        it('deve retornar status 200 informando que o e-mail foi reenviado (sucesso silencioso)', async () => {
            mockReq.body = { email: '798456' };

            mockUsersService.resendConfirmEmail.mockResolvedValue();
            await usersController.resendConfirmationEmail(mockReq as Request, mockRes as Response);

            expect(mockUsersService.resendConfirmEmail).toHaveBeenCalledWith(mockReq.body?.email);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ message: 'Um novo e-mail de confirmação foi enviado para o endereço informado.' });
        });
    });
});
