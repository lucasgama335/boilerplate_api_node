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
            hash: vi.fn().mockResolvedValue('hashed-password-result'),
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

    describe('RegisterUser', () => {
        it('deve registrar um novo usuário com sucesso e aplicar hash na senha', async () => {
            const user = await authService.registerUser({
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                password: 'secure-password-123',
                passwordConfirmation: 'password-123',
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
                authService.registerUser({
                    firstName: 'Other',
                    lastName: 'Person',
                    email: 'existing@example.com',
                    password: 'password-123',
                    passwordConfirmation: 'password-123',
                }),
            ).rejects.toBeInstanceOf(AppError);
        });
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
        it('deve lançar um erro se o refresh token não for fornecido', async () => {
            await expect(authService.refresh('', '127.0.0.1', 'Mozilla/5.0')).rejects.toBeInstanceOf(AppError);
        });

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

            expect(result).toHaveProperty('accessToken', 'access-token-jwt-123');
            expect(result).toHaveProperty('newRawRefreshToken');
            expect(result.newRawRefreshToken).not.toBe(rawToken);

            const oldRecord = await refreshTokenRepository.findByTokenHash(hashedToken);
            expect(oldRecord?.revokedAt).not.toBeNull();
            expect(refreshTokenRepository.items).toHaveLength(2);
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

    describe('Refresh com Grace Period (Concorrência)', () => {
        it('deve permitir a atualização com sucesso se o token foi revogado dentro da janela de graça (concorrência)', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const rawToken = 'grace-period-token';
            const hashedToken = hashToken(rawToken);
            const expiresAt = new Date(Date.now() + 86400000);

            await refreshTokenRepository.create(user.id, hashedToken, expiresAt, '127.0.0.1', 'São Paulo', 'SP', 'Brazil', 'Windows', 'Desktop');

            // Simula que o token foi revogado há apenas 5 segundos (dentro da janela de 20s)
            const tokenRecord = await refreshTokenRepository.findByTokenHash(hashedToken);
            if (tokenRecord) {
                tokenRecord.revokedAt = new Date(Date.now() - 5000);
            }

            const result = await authService.refresh(rawToken, '127.0.0.1', 'Mozilla/5.0');

            expect(result).toHaveProperty('accessToken', 'access-token-jwt-123');
            expect(result).toHaveProperty('newRawRefreshToken');
        });

        it('deve revogar todas as sessões se tentar usar um token revogado fora da janela de graça (reuso malicioso)', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const rawToken = 'expired-grace-token';
            const hashedToken = hashToken(rawToken);
            const expiresAt = new Date(Date.now() + 86400000);

            await refreshTokenRepository.create(user.id, hashedToken, expiresAt, '127.0.0.1', 'São Paulo', 'SP', 'Brazil', 'Windows', 'Desktop');

            // Simula que o token foi revogado há 25 segundos (FORA da janela de 20s)
            const tokenRecord = await refreshTokenRepository.findByTokenHash(hashedToken);
            if (tokenRecord) {
                tokenRecord.revokedAt = new Date(Date.now() - 25000);
            }

            const revokeTokensSpy = vi.spyOn(tokenValidityProvider, 'revokeAllTokens');

            await expect(authService.refresh(rawToken, '127.0.0.1', 'Mozilla/5.0')).rejects.toBeInstanceOf(AppError);

            expect(revokeTokensSpy).toHaveBeenCalledWith(user.id);
        });
    });

    describe('RevokeByRawToken (Logout Individual)', () => {
        it('deve revogar um token específico com sucesso', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const rawToken = 'token-to-revoke';
            const hashedToken = hashToken(rawToken);
            await refreshTokenRepository.create(user.id, hashedToken, new Date(Date.now() + 86400000), '127.0.0.1', 'SP', 'SP', 'BR', 'Win', 'Desktop');

            await authService.revokeByRawToken(rawToken);

            const record = await refreshTokenRepository.findByTokenHash(hashedToken);
            expect(record?.revokedAt).not.toBeNull();
        });

        it('deve lançar erro se o token a ser revogado não for encontrado', async () => {
            await expect(authService.revokeByRawToken('token-que-nao-existe')).rejects.toBeInstanceOf(AppError);
        });

        it('deve disparar segurança defensiva se tentar revogar um token que já estava revogado há muito tempo', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const rawToken = 'already-revoked-token';
            const hashedToken = hashToken(rawToken);
            const tokenId = await refreshTokenRepository.create(user.id, hashedToken, new Date(Date.now() + 86400000), '127.0.0.1', 'SP', 'SP', 'BR', 'Win', 'Desktop');

            await refreshTokenRepository.revokeToken(tokenId);

            // Simula que ele já estava revogado há mais de 20 segundos
            const tokenRecord = await refreshTokenRepository.findByTokenHash(hashedToken);
            if (tokenRecord) {
                tokenRecord.revokedAt = new Date(Date.now() - 25000);
            }

            const revokeTokensSpy = vi.spyOn(tokenValidityProvider, 'revokeAllTokens');

            await expect(authService.revokeByRawToken(rawToken)).rejects.toBeInstanceOf(AppError);

            expect(revokeTokensSpy).toHaveBeenCalledWith(user.id);
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

            const currentRecord = await refreshTokenRepository.findByTokenHash(currentHashed);
            expect(currentRecord?.revokedAt).toBeNull();

            const otherRecord = await refreshTokenRepository.findByTokenHash(otherHashed);
            expect(otherRecord?.revokedAt).not.toBeNull();
        });

        it('deve realizar logout global (destruir todos os tokens) quando keepCurrentSession for false', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hash',
            });

            const token1 = hashToken('token-1');
            const token2 = hashToken('token-2');

            await refreshTokenRepository.create(user.id, token1, new Date(Date.now() + 86400000), '127', 'SP', 'SP', 'BR', 'Win', 'Desk');
            await refreshTokenRepository.create(user.id, token2, new Date(Date.now() + 86400000), '127', 'SP', 'SP', 'BR', 'Win', 'Desk');

            const result = await authService.revokeSessionsService(user.id, false);

            expect(result).toHaveProperty('accessToken', null);
            expect(refreshTokenRepository.items.every((t) => t.revokedAt !== null)).toBe(true);
        });
    });
});
