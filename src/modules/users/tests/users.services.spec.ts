/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '../fakes/fake-users.repository';
import { UserService } from '../users.services';

describe('User Service (Unit Test)', () => {
    let usersRepository: InMemoryUserRepository;
    let userService: UserService;
    let hashProviderMock: any;

    beforeEach(() => {
        usersRepository = new InMemoryUserRepository();

        hashProviderMock = {
            hash: vi.fn().mockResolvedValue('hashed-password-result'),
            compare: vi.fn(),
        };

        userService = new UserService(usersRepository, hashProviderMock);
    });

    describe('getProfile', () => {
        it('deve retornar o perfil de um usuário existente com sucesso (SafeUser)', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@example.com',
                passwordHash: 'any-hashed-password',
            });

            const profile = await userService.getProfile(createdUser.id);

            expect(profile).toBeDefined();
            expect(profile.id).toBe(createdUser.id);
            expect(profile.email).toBe('alice@example.com');
            expect(profile.firstName).toBe('Alice');

            // Garantia de segurança: o contrato não deve vazar a senha
            expect(profile).not.toHaveProperty('passwordHash');
        });

        it('deve lançar AppError (404) caso o usuário não seja encontrado', async () => {
            const invalidId = 'id-que-nao-existe';

            await expect(userService.getProfile(invalidId)).rejects.toMatchObject(new AppError('Usuário não encontrado', 404));
        });
    });

    describe('registerUser', () => {
        it('deve registrar um novo usuário com sucesso e aplicar hash na senha', async () => {
            const user = await userService.registerUser({
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                password: 'secure-password-123',
                passwordConfirmation: 'secure-password-123',
            });

            expect(user).toHaveProperty('id');
            expect(user.email).toBe('jane@example.com');
            expect(hashProviderMock.hash).toHaveBeenCalledWith('secure-password-123');

            const savedUser = await usersRepository.findByEmail('jane@example.com', true);
            expect(savedUser?.passwordHash).toBe('hashed-password-result');
        });

        it('deve lançar um erro ao tentar registrar um e-mail que já existe', async () => {
            await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'existing@example.com',
                passwordHash: 'some-hash',
            });

            await expect(
                userService.registerUser({
                    firstName: 'Other',
                    lastName: 'Person',
                    email: 'existing@example.com',
                    password: 'password-123',
                    passwordConfirmation: 'password-123',
                }),
            ).rejects.toBeInstanceOf(AppError);
        });
    });
});
