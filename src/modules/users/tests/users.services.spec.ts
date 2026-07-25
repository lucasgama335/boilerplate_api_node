/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryUserRepository } from '../fakes/fake-users.repository';
import { UserService } from '../users.services';

describe('User Service (Unit Test)', () => {
    let usersRepository: InMemoryUserRepository;
    let userService: UserService;
    let hashProviderMock: any;
    let tokenProviderMock: any;

    beforeEach(() => {
        usersRepository = new InMemoryUserRepository();

        hashProviderMock = {
            hash: vi.fn().mockResolvedValue('hashed-password-result'),
            compare: vi.fn(),
        };

        tokenProviderMock = {
            generateEmailConfirmationToken: vi.fn().mockReturnValue('email-token-xyz'),
            verifyEmailConfirmationToken: vi.fn(),
            decode: vi.fn(),
        };

        userService = new UserService(usersRepository, hashProviderMock, tokenProviderMock);
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
            expect(profile).not.toHaveProperty('passwordHash');
        });

        it('deve lançar AppError (404) caso o usuário não seja encontrado', async () => {
            const invalidId = 'id-que-nao-existe';

            await expect(userService.getProfile(invalidId)).rejects.toMatchObject(new AppError('Usuário não encontrado', 404));
        });
    });

    describe('registerUser', () => {
        it('deve registrar um novo usuário com sucesso, aplicar hash na senha e gerar token de confirmação', async () => {
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
            expect(tokenProviderMock.generateEmailConfirmationToken).toHaveBeenCalled();

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

    describe('confirmEmail', () => {
        it('deve confirmar o e-mail com sucesso quando o token for válido', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash',
            });

            tokenProviderMock.decode.mockReturnValue({ sub: createdUser.id, purpose: 'email-confirmation' });
            tokenProviderMock.verifyEmailConfirmationToken.mockReturnValue({ sub: createdUser.id });

            await userService.confirmEmail('valid-token');

            const updatedUser = await usersRepository.findById(createdUser.id, true);
            expect(updatedUser?.isEmailConfirmed).toBe(true);
        });

        it('deve lançar AppError se o propósito do token for incorreto', async () => {
            tokenProviderMock.decode.mockReturnValue({ sub: 'user-123', purpose: 'wrong-purpose' });

            await expect(userService.confirmEmail('token')).rejects.toMatchObject(new AppError('Token de confirmação de e-mail inválido.', 400));
        });

        it('deve lançar AppError 404 se o usuário não for encontrado', async () => {
            tokenProviderMock.decode.mockReturnValue({ sub: 'non-existent', purpose: 'email-confirmation' });

            await expect(userService.confirmEmail('token')).rejects.toMatchObject(new AppError('Usuário não encontrado.', 404));
        });

        it('deve lançar AppError se o e-mail já estiver confirmado', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash',
            });
            await usersRepository.confirmEmail(createdUser.id);

            tokenProviderMock.decode.mockReturnValue({ sub: createdUser.id, purpose: 'email-confirmation' });

            await expect(userService.confirmEmail('token')).rejects.toMatchObject(new AppError('Este e-mail já foi confirmado anteriormente.', 400));
        });

        it('deve lançar AppError 401 se a verificação do token falhar', async () => {
            const createdUser = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash',
            });

            tokenProviderMock.decode.mockReturnValue({ sub: createdUser.id, purpose: 'email-confirmation' });
            tokenProviderMock.verifyEmailConfirmationToken.mockImplementation(() => {
                throw new Error('expired');
            });

            await expect(userService.confirmEmail('expired-token')).rejects.toMatchObject(new AppError('Token de confirmação inválido ou expirado.', 401));
        });
    });

    describe('resendConfirmEmail', () => {
        it('deve gerar um novo token de confirmação para um usuário existente não confirmado', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash',
            });

            await userService.resendConfirmEmail('john@example.com');

            expect(tokenProviderMock.generateEmailConfirmationToken).toHaveBeenCalledWith(user.id, false);
        });

        it('deve executar hash dummy e não gerar token para e-mail inexistente (anti-timing attack)', async () => {
            await userService.resendConfirmEmail('nao-existe@example.com');

            expect(hashProviderMock.hash).toHaveBeenCalled();
            expect(tokenProviderMock.generateEmailConfirmationToken).not.toHaveBeenCalled();
        });

        it('deve retornar silenciosamente sem gerar token se o e-mail já estiver confirmado', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash',
            });
            await usersRepository.confirmEmail(user.id);

            await userService.resendConfirmEmail('john@example.com');

            expect(tokenProviderMock.generateEmailConfirmationToken).not.toHaveBeenCalled();
        });
    });
});
