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
        // Mockamos os métodos do serviço de usuários
        mockUserService = {
            registerUser: vi.fn(),
            getProfile: vi.fn(),
        };

        // Injetamos o serviço falso no controller
        usersController = new UsersController(mockUserService);

        // Limpamos os mocks
        vi.clearAllMocks();

        // Simulamos a requisição
        req = {
            body: {},
            user: undefined,
        };

        // Simulamos a resposta (com encadeamento: res.status().json())
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
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

            // Simulamos o retorno de sucesso do serviço
            mockUserService.registerUser.mockResolvedValue(expectedUserReturn);

            await usersController.registerUser(req as Request, res as Response);

            // Validações
            expect(mockUserService.registerUser).toHaveBeenCalledWith(userData);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expectedUserReturn);
        });
    });

    describe('showProfile', () => {
        it('deve extrair o ID do usuário do token (req.user), buscar o perfil e retornar 200', async () => {
            // Simulamos que o middleware de autenticação já injetou o usuário
            req.user = { id: 'uuid-456' };

            const expectedProfile = {
                id: 'uuid-456',
                firstName: 'John',
                lastName: 'Smith',
                email: 'john@example.com',
            };

            // Simulamos a busca bem-sucedida do perfil
            mockUserService.getProfile.mockResolvedValue(expectedProfile);

            await usersController.showProfile(req as Request, res as Response);

            // Validações
            expect(mockUserService.getProfile).toHaveBeenCalledWith('uuid-456');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expectedProfile);
        });
    });
});
