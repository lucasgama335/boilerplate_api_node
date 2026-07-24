/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { InMemoryTokenValidityProvider } from '@/app/infra/token-validity/fakes/fake-token-validity-provider';
import { hashToken } from '@/app/utils/hash-token';
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

    let hashProviderMock: any;
    let tokenProviderMock: any;
    let geolocationProviderMock: any;
    let userAgentProviderMock: any;

    beforeEach(() => {
        usersRepository = new InMemoryUserRepository();
        loginAttemptsRepository = new InMemoryLoginAttemptsRepository();
        refreshTokenRepository = new InMemoryRefreshTokenRepository();
        tokenValidityProvider = new InMemoryTokenValidityProvider(usersRepository);

        hashProviderMock = {
            compare: vi.fn(),
            hash: vi.fn().mockResolvedValue('hashed-password'),
        };

        tokenProviderMock = {
            generate: vi.fn().mockReturnValue('access-token-jwt-123'),
            generateRefreshToken: vi.fn().mockResolvedValue('refresh-token-xyz'),
        };

        geolocationProviderMock = {
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

    describe('LoginUser', () => {
        it('deve autenticar um usuário com sucesso quando as credenciais forem válidas', async () => {
            await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hashed-password',
            });

            hashProviderMock.compare.mockImplementation(async (password: string) => {
                return password === 'correct-password';
            });

            const result = await authService.loginUser(
                {
                    email: 'john@example.com',
                    password: 'correct-password',
                },
                '127.0.0.1',
                'Mozilla/5.0',
            );

            expect(result).toHaveProperty('token');
            expect(result.token).toBe('access-token-jwt-123');
            expect(loginAttemptsRepository.items).toHaveLength(1);
            expect(loginAttemptsRepository.items[0].status).toBe('success');
            expect(loginAttemptsRepository.items[0].city).toBe('São Paulo');
            expect(refreshTokenRepository.items).toHaveLength(1);
            expect(refreshTokenRepository.items[0].userId).toBe(result.user.id);
        });

        it('deve lançar um erro e registrar tentativa falha ao tentar logar com senha incorreta', async () => {
            await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hashed-password',
            });

            hashProviderMock.compare.mockImplementation(async (password: string) => {
                return password === 'correct-password';
            });

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

            expect(loginAttemptsRepository.items).toHaveLength(1);
            expect(loginAttemptsRepository.items[0].status).toBe('fail');
        });

        it('deve lançar um erro caso o usuário não seja encontrado', async () => {
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

            expect(loginAttemptsRepository.items).toHaveLength(1);
            expect(loginAttemptsRepository.items[0].status).toBe('fail');
        });
    });

    describe('Refresh', () => {
        it('deve atualizar o token com sucesso usando um refresh token válido (rotação)', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const rawToken = 'my-raw-refresh-token';
            const hashedToken = hashToken(rawToken);
            const expiresAt = new Date(Date.now() + 86400000); // Amanhã

            await refreshTokenRepository.create(user.id, hashedToken, expiresAt, '127.0.0.1', 'São Paulo', 'SP', 'Brazil', 'Windows', 'Desktop');

            const result = await authService.refresh(rawToken, '127.0.0.1', 'Mozilla/5.0');

            expect(result).toHaveProperty('token', 'access-token-jwt-123');
            expect(result).toHaveProperty('refreshToken');
            expect(result.refreshToken).not.toBe(rawToken);

            // Confirma que o token antigo foi revogado (rotação) e um novo foi criado
            const oldRecord = await refreshTokenRepository.findByTokenHash(hashedToken);
            expect(oldRecord?.revoked).toBe(true);
            expect(refreshTokenRepository.items).toHaveLength(2); // Antigo revogado + novo gerado
        });

        it('deve revogar todos os tokens do usuário se tentar reutilizar um refresh token já revogado (detecção de roubo)', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const rawToken = 'compromised-token';
            const hashedToken = hashToken(rawToken);
            const expiresAt = new Date(Date.now() + 86400000);

            const tokenId = await refreshTokenRepository.create(user.id, hashedToken, expiresAt, '127.0.0.1', 'São Paulo', 'SP', 'Brazil', 'Windows', 'Desktop');

            // Simula que o token já havia sido revogado anteriormente
            await refreshTokenRepository.revokeToken(tokenId);

            await expect(authService.refresh(rawToken, '127.0.0.1', 'Mozilla/5.0')).rejects.toBeInstanceOf(AppError);

            // Garante que todos os tokens do usuário foram revogados por segurança
            expect(refreshTokenRepository.items.every((t) => t.revoked)).toBe(true);
        });

        it('deve lançar um erro ao tentar atualizar usando um refresh token expirado', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const rawToken = 'expired-token';
            const hashedToken = hashToken(rawToken);
            const expiresAt = new Date(Date.now() - 1000); // Já expirou

            await refreshTokenRepository.create(user.id, hashedToken, expiresAt, '127.0.0.1', 'São Paulo', 'SP', 'Brazil', 'Windows', 'Desktop');

            await expect(authService.refresh(rawToken, '127.0.0.1', 'Mozilla/5.0')).rejects.toBeInstanceOf(AppError);
        });
    });

    describe('RevokeSessionsService', () => {
        it('deve revogar todas as sessões exceto a atual quando keepCurrentSession for true', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const currentRawToken = 'current-session-token';
            const currentHashed = hashToken(currentRawToken);
            await refreshTokenRepository.create(user.id, currentHashed, new Date(Date.now() + 86400000), '127.0.0.1', 'SP', 'SP', 'BR', 'Win', 'Desktop');

            const otherRawToken = 'other-session-token';
            const otherHashed = hashToken(otherRawToken);
            await refreshTokenRepository.create(user.id, otherHashed, new Date(Date.now() + 86400000), '127.0.0.1', 'SP', 'SP', 'BR', 'Win', 'Desktop');

            const result = await authService.revokeSessionsService(user.id, true, currentRawToken);

            expect(result).toHaveProperty('accessToken', 'access-token-jwt-123');

            // A sessão atual deve continuar ativa (não revogada)
            const currentRecord = await refreshTokenRepository.findByTokenHash(currentHashed);
            expect(currentRecord?.revoked).toBe(false);

            // A outra sessão deve ter sido revogada
            const otherRecord = await refreshTokenRepository.findByTokenHash(otherHashed);
            expect(otherRecord?.revoked).toBe(true);
        });
    });
});
