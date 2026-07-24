import { AppError } from '@/app/exceptions/AppError';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../fakes/fake-users.repository';
import { UserService } from '../users.services';

describe('User Service (Unit Test)', () => {
    let usersRepository: InMemoryUserRepository;
    let userService: UserService;

    beforeEach(() => {
        // Inicializa o repositório em memória e o serviço antes de cada teste
        usersRepository = new InMemoryUserRepository();
        userService = new UserService(usersRepository);
    });

    describe('getProfile', () => {
        it('deve retornar o perfil de um usuário existente com sucesso (SafeUser)', async () => {
            // 1. Preparação: Criamos um usuário no banco falso
            const createdUser = await usersRepository.create({
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@example.com',
                passwordHash: 'any-hashed-password',
            });

            // 2. Ação: Buscamos o perfil usando o serviço
            const profile = await userService.getProfile(createdUser.id);

            // 3. Asserção: O perfil deve estar definido e bater com os dados criados
            expect(profile).toBeDefined();
            expect(profile.id).toBe(createdUser.id);
            expect(profile.email).toBe('alice@example.com');
            expect(profile.firstName).toBe('Alice');

            // Garantia de segurança: o contrato do repositório/serviço não deve vazar a senha
            expect(profile).not.toHaveProperty('passwordHash');
        });

        it('deve lançar AppError (404) caso o usuário não seja encontrado', async () => {
            // 1. Ação & Asserção: Tentamos buscar um ID que não inserimos no banco falso
            const invalidId = 'id-que-nao-existe';

            await expect(userService.getProfile(invalidId)).rejects.toMatchObject(new AppError('Usuário não encontrado', 404));
        });
    });
});
