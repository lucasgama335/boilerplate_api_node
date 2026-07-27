/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../users.service';
import { InMemoryUsersRepository } from './repositories/in-memory-users.repository';

describe('[UNIT TEST]: Módulo de Usuários - Service', () => {
    let usersService: UserService;
    let hashProvider: IHashProvider;
    let tokenProvider: ITokenProvider;

    let usersRepository: InMemoryUsersRepository;

    beforeEach(() => {
        usersRepository = new InMemoryUsersRepository();
        hashProvider = {
            hash: vi.fn(),
            compare: vi.fn(),
        };
        tokenProvider = {
            generate: vi.fn(),
            generatePasswordResetToken: vi.fn(),
            generateEmailConfirmationToken: vi.fn(),
            verify: vi.fn(),
            verifyPasswordResetToken: vi.fn(),
            verifyEmailConfirmationToken: vi.fn(),
            decode: vi.fn(),
        };

        usersService = new UserService(usersRepository, hashProvider, tokenProvider);
    });

    describe('[method]: #getProfile', () => {
        it('deve retornar AppError 404 se o id for de um usuário inexistente', async () => {
            await expect(usersService.getProfile('123')).rejects.toBeInstanceOf(AppError);
            await expect(usersService.getProfile('123')).rejects.toMatchObject({
                statusCode: 404,
                message: 'Usuário não encontrado.',
            });
        });
    });

    describe('[method]: #registerUser', () => {
        it('deve retornar AppError 409 se o e-mail a ser cadastrado já estiver sendo utilizado por outro usuário', async () => {
            await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'teste@example.com',
                passwordHash: 'ARtr@8796',
            });

            await expect(
                usersService.registerUser({
                    firstName: 'John',
                    lastName: 'Doe Jr.',
                    email: 'teste@example.com',
                    password: 'ARtr@8626',
                    passwordConfirmation: 'ARtr@8626',
                }),
            ).rejects.toBeInstanceOf(AppError);
            await expect(
                usersService.registerUser({
                    firstName: 'John',
                    lastName: 'Doe Jr.',
                    email: 'teste@example.com',
                    password: 'ARtr@8626',
                    passwordConfirmation: 'ARtr@8626',
                }),
            ).rejects.toMatchObject({
                statusCode: 409,
                message: 'Esse e-mail já está vinculado a uma conta cadastrada no sistema.',
            });
        });

        it('deve retornar AppError 400 quando no array de departamentos houver um id inexistente', async () => {
            usersRepository.validDepartmentIds = new Set(['department-1']);
            const payload = {
                firstName: 'João',
                lastName: 'Silva',
                email: 'teste@example.com',
                password: 'ARtr@8626',
                passwordConfirmation: 'ARtr@8626',
                departments: ['dep-valido-123', 'dep-inexistente-999'],
            };

            await expect(usersService.registerUser(payload)).rejects.toBeInstanceOf(AppError);
            await expect(usersService.registerUser(payload)).rejects.toMatchObject({
                statusCode: 400,
                message: 'Um ou mais IDs de departamentos informados são inválidos ou não existem.',
            });
        });

        it('deve criar o usuário com sucesso quando todos os departamentos informados existirem e chamar a função de geração de token para confirmação de e-mail', async () => {
            usersRepository.validDepartmentIds = new Set(['dep-1', 'dep-2']);

            const payload = {
                firstName: 'João',
                lastName: 'Silva',
                email: 'teste@example.com',
                password: 'ARtr@8626',
                passwordConfirmation: 'ARtr@8626',
                departments: ['dep-1', 'dep-2'],
            };

            const spyFunc = vi.spyOn(tokenProvider, 'generateEmailConfirmationToken');
            const result = await usersService.registerUser(payload);

            expect(spyFunc).toHaveBeenCalled();
            expect(result).toHaveProperty('id');
            expect(result.email).toBe('teste@example.com');

            const savedDepartments = usersRepository.userDepartmentsMap.get(result.id);
            expect(savedDepartments).toEqual(['dep-1', 'dep-2']);
        });
    });

    describe('[method]: #confirmEmail', () => {
        it('deve retornar AppError 400 se o token não puder ser decodificado', async () => {
            vi.spyOn(tokenProvider, 'decode').mockImplementation(() => {
                throw new Error('Invalid token format');
            });

            await expect(usersService.confirmEmail('token-malformado')).rejects.toMatchObject({
                statusCode: 400,
                message: 'Token de confirmação de e-mail inválido.',
            });
        });

        it('deve retornar AppError 400 se o token for decodificado, mas o purpose for diferente de email-confirmation', async () => {
            vi.spyOn(tokenProvider, 'decode').mockReturnValue({
                sub: '12345',
                purpose: 'reset-password', // Purpose errado!
            } as any);

            await expect(usersService.confirmEmail('token-com-purpose-errado')).rejects.toMatchObject({
                statusCode: 400,
                message: 'Token de confirmação de e-mail inválido.',
            });
        });

        it('deve retornar AppError 404 se o token for válido, mas o usuário não existir no banco', async () => {
            vi.spyOn(tokenProvider, 'decode').mockReturnValue({
                sub: 'id-inexistente',
                purpose: 'email-confirmation',
            } as any);

            await expect(usersService.confirmEmail('token-sem-usuario')).rejects.toMatchObject({
                statusCode: 404,
                message: 'Usuário não encontrado.',
            });
        });

        it('deve retornar AppError 400 se o e-mail do usuário já estiver confirmado', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'Ana',
                lastName: 'Souza',
                email: 'ana@example.com',
                passwordHash: 'hash',
            });

            await usersRepository.confirmEmail(createdUser.id);
            vi.spyOn(tokenProvider, 'decode').mockReturnValue({
                sub: createdUser.id,
                purpose: 'email-confirmation',
            } as any);

            await expect(usersService.confirmEmail('token-ja-confirmado')).rejects.toBeInstanceOf(AppError);
            await expect(usersService.confirmEmail('token-ja-confirmado')).rejects.toMatchObject({
                statusCode: 400,
                message: 'Este e-mail já foi confirmado anteriormente.',
            });
        });

        it('deve retornar AppError 401 se a assinatura do token for inválida ou o token estiver expirado', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'Ana',
                lastName: 'Souza',
                email: 'ana@example.com',
                passwordHash: 'hash',
            });

            vi.spyOn(tokenProvider, 'decode').mockReturnValue({
                sub: createdUser.id,
                purpose: 'email-confirmation',
            } as any);
            vi.spyOn(tokenProvider, 'verifyEmailConfirmationToken').mockImplementation(() => {
                throw new Error('Token expired');
            });

            await expect(usersService.confirmEmail('token-expirado')).rejects.toMatchObject({
                statusCode: 401,
                message: 'Token de confirmação inválido ou expirado.',
            });
        });

        it('deve confirmar o e-mail do usuário com sucesso quando o token e a assinatura forem totalmente válidos', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'Ana',
                lastName: 'Souza',
                email: 'ana-sucesso@example.com',
                passwordHash: 'hash',
            });

            vi.spyOn(tokenProvider, 'decode').mockReturnValue({
                sub: createdUser.id,
                purpose: 'email-confirmation',
            } as any);
            vi.spyOn(tokenProvider, 'verifyEmailConfirmationToken').mockReturnValue({} as any);
            await usersService.confirmEmail('token-100-porcento-valido');

            const updatedUser = await usersRepository.findById(createdUser.id, true);
            expect(updatedUser?.isEmailConfirmed).toBe(true);
        });
    });

    describe('[method]: #resendConfirmEmail', () => {
        it('deve retornar sucesso silencioso caso o usuário não exista', async () => {
            const result = await usersService.resendConfirmEmail('ana-sucesso@example.com');

            expect(result).toBeUndefined();
        });

        it('deve retornar sucesso silencioso caso o usuário já tenha o e-mail confirmado', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'Ana',
                lastName: 'Souza',
                email: 'ana-sucesso@example.com',
                passwordHash: 'hash',
                isEmailConfirmed: true,
            });

            const result = await usersService.resendConfirmEmail(createdUser.email);

            expect(result).toBeUndefined();
        });

        it('deve chamar a função generateEmailConfirmationToken para gerar o novo token de confirmação do usuário', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'Ana',
                lastName: 'Souza',
                email: 'ana-sucesso@example.com',
                passwordHash: 'hash',
            });

            const spyFunc = vi.spyOn(tokenProvider, 'generateEmailConfirmationToken');
            await usersService.resendConfirmEmail(createdUser.email);

            expect(spyFunc).toHaveBeenCalled();
        });
    });
});
