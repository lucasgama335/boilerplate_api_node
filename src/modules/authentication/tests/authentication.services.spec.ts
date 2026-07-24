/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { InMemoryTokenValidityProvider } from '@/app/infra/token-validity/fakes/fake-token-validity-provider';
import { InMemoryUserRepository } from '@/modules/users/fakes/fake-users.repository';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticateUserService } from '../authentication.services';
import { InMemoryLoginAttemptsRepository } from '../fakes/fake-login-attempts.repository';
import { InMemoryRefreshTokenRepository } from '../fakes/fake-refresh-tokens.repository';

describe('Authentication Service (Unit Test)', () => {
    let authService: AuthenticateUserService;
    let usersRepository: InMemoryUserRepository;
    let loginAttemptsRepository: InMemoryLoginAttemptsRepository;
    let refreshTokenRepository: InMemoryRefreshTokenRepository;
    let tokenValidityProvider: InMemoryTokenValidityProvider;

    // Mocks simples para os provedores externos
    let hashProviderMock: any;
    let tokenProviderMock: any;
    let geolocationProviderMock: any;
    let userAgentProviderMock: any;

    beforeEach(() => {
        usersRepository = new InMemoryUserRepository();
        loginAttemptsRepository = new InMemoryLoginAttemptsRepository();
        refreshTokenRepository = new InMemoryRefreshTokenRepository();
        tokenValidityProvider = new InMemoryTokenValidityProvider(usersRepository);

        // Configurando os mocks dos provedores
        hashProviderMock = {
            compare: vi.fn(),
            hash: vi.fn().mockResolvedValue('hashed-password'),
        };

        tokenProviderMock = {
            generate: vi.fn().mockReturnValue('access-token-jwt-123'),
            generateRefreshToken: vi.fn().mockResolvedValue('refresh-token-xyz'),
        };

        geolocationProviderMock = {
            // CORRIGIDO: de mockResolvedValue para mockReturnValue,
            // já que o método lookup no service não é assíncrono (não usa await)
            lookup: vi.fn().mockReturnValue({
                city: 'São Paulo',
                region: 'SP',
                country: 'Brazil',
            }),
        };

        userAgentProviderMock = {
            parse: vi.fn().mockReturnValue({
                os: 'Windows',
                deviceType: 'Desktop',
            }),
        };

        // Instanciando o Service injetando as versões Fakes/Mocks
        authService = new AuthenticateUserService(
            usersRepository as any,
            refreshTokenRepository as any,
            loginAttemptsRepository as any,
            hashProviderMock,
            tokenProviderMock,
            geolocationProviderMock,
            userAgentProviderMock,
            tokenValidityProvider as any,
        );
    });

    it('deve autenticar um usuário com sucesso quando as credenciais forem válidas', async () => {
        // Arrange
        await usersRepository.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            passwordHash: 'valid-hashed-password',
        });

        hashProviderMock.compare.mockImplementation(async (password: string) => {
            return password === 'correct-password';
        });

        // Act
        const result = await authService.loginUser(
            {
                email: 'john@example.com',
                password: 'correct-password',
            },
            '127.0.0.1',
            'Mozilla/5.0',
        );

        // Assert
        expect(result).toHaveProperty('token');
        expect(result.token).toBe('access-token-jwt-123');

        // Verifica se a tentativa de login de sucesso foi registrada na auditoria
        expect(loginAttemptsRepository.items).toHaveLength(1);
        expect(loginAttemptsRepository.items[0].status).toBe('success');
        expect(loginAttemptsRepository.items[0].city).toBe('São Paulo');

        // Verifica se a tentativa de login de sucesso gerou um refresh token na tabela
        expect(refreshTokenRepository.items).toHaveLength(1);
        expect(refreshTokenRepository.items[0].userId).toBe(result.user.id);
    });

    it('deve lançar um erro e registrar tentativa falha ao tentar logar com senha incorreta', async () => {
        // Arrange
        await usersRepository.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            passwordHash: 'valid-hashed-password',
        });

        hashProviderMock.compare.mockImplementation(async (password: string) => {
            return password === 'correct-password'; // Como mandaremos 'wrong-password', vai retornar false
        });

        // Act & Assert
        await expect(
            authService.loginUser(
                {
                    email: 'john@example.com',
                    password: 'wrong-password',
                },
                '127.0.0.1',
                'Mozilla/5.0',
            ),
        ).rejects.toBeInstanceOf(AppError);

        // Verifica se a tentativa falha foi gravada corretamente
        expect(loginAttemptsRepository.items).toHaveLength(1);
        expect(loginAttemptsRepository.items[0].status).toBe('fail');
    });

    it('deve lançar um erro caso o usuário não seja encontrado', async () => {
        // Act & Assert
        await expect(
            authService.loginUser(
                {
                    email: 'nao-existo@example.com',
                    password: 'any-password',
                },
                '127.0.0.1',
                'Mozilla/5.0',
            ),
        ).rejects.toBeInstanceOf(AppError);

        // Nenhuma tentativa de sucesso deve ter ocorrido
        expect(loginAttemptsRepository.items).toHaveLength(1);
        expect(loginAttemptsRepository.items[0].status).toBe('fail');
    });
});
