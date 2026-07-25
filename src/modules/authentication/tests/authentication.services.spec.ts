/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { InMemoryUserSessionRevocationProvider } from '@/app/infra/user-session-revocation/fakes/fake-user-session-revocation-provider';
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
    let userSessionRevocationProvider: InMemoryUserSessionRevocationProvider;

    let hashProviderMock: any;
    let tokenProviderMock: any;
    let geolocationProviderMock: any;
    let userAgentProviderMock: any;

    beforeEach(() => {
        usersRepository = new InMemoryUserRepository();
        loginAttemptsRepository = new InMemoryLoginAttemptsRepository();
        refreshTokenRepository = new InMemoryRefreshTokenRepository();
        userSessionRevocationProvider = new InMemoryUserSessionRevocationProvider(usersRepository);

        hashProviderMock = {
            compare: vi.fn(),
            hash: vi.fn().mockResolvedValue('hashed-password-result'),
        };

        tokenProviderMock = {
            generate: vi.fn().mockReturnValue('access-token-jwt-123'),
            generateRefreshToken: vi.fn().mockResolvedValue('refresh-token-xyz'),
        };

        geolocationProviderMock = {
            lookup: vi.fn().mockReturnValue({ city: 'São Paulo', region: 'SP', country: 'Brazil' }),
        };

        userAgentProviderMock = {
            parse: vi.fn().mockReturnValue({ os: 'Windows', deviceType: 'Desktop' }),
        };

        authService = new AuthenticateUserService(
            usersRepository as any,
            refreshTokenRepository as any,
            loginAttemptsRepository as any,
            hashProviderMock,
            tokenProviderMock,
            geolocationProviderMock,
            userAgentProviderMock,
            userSessionRevocationProvider as any,
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

            hashProviderMock.compare.mockImplementation(async (password: string) => password === 'correct-password');

            const result = await authService.loginUser({ email: 'john@example.com', password: 'correct-password' }, '127.0.0.1', 'Mozilla/5.0');

            expect(result).toHaveProperty('token');
            expect(result.token).toBe('access-token-jwt-123');
            expect(loginAttemptsRepository.items[0].status).toBe('success');
        });

        it('deve lançar um erro e registrar tentativa falha ao tentar logar com senha incorreta', async () => {
            await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            hashProviderMock.compare.mockResolvedValue(false);

            await expect(authService.loginUser({ email: 'john@example.com', password: 'wrong' }, '127.0.0.1', 'Mozilla/5.0')).rejects.toBeInstanceOf(AppError);
            expect(loginAttemptsRepository.items[0].status).toBe('fail');
        });
    });

    describe('Refresh', () => {
        it('deve atualizar o token com sucesso usando um refresh token válido (rotação)', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            const rawToken = 'my-raw-refresh-token';
            const hashedToken = hashToken(rawToken);

            await refreshTokenRepository.create(user.id, hashedToken, new Date(Date.now() + 86400000), '127.0.0.1', 'SP', 'SP', 'BR', 'Win', 'Desktop');

            const result = await authService.refresh(rawToken, '127.0.0.1', 'Mozilla/5.0');

            expect(result.accessToken).toBe('access-token-jwt-123');
            expect(result.newRawRefreshToken).not.toBe(rawToken);
        });
    });

    describe('ChangeAuthenticatedUserPassword', () => {
        it('deve trocar a senha com sucesso, invalidar sessões globais e preservar apenas o refresh token atual', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'old-hashed-password',
            });

            hashProviderMock.compare.mockResolvedValue(true);
            hashProviderMock.hash.mockResolvedValue('new-hashed-password');

            const revokeSessionsSpy = vi.spyOn(userSessionRevocationProvider, 'revokeAllTokens');
            const revokeRefreshSpy = vi.spyOn(refreshTokenRepository, 'revokeAllTokensByUser');

            const result = await authService.changeAuthenthicatedUserPassword(user.id, 'NewPassword!123', 'current-refresh-token', 'OldPassword!123');

            expect(hashProviderMock.compare).toHaveBeenCalledWith('OldPassword!123', 'old-hashed-password');
            expect(hashProviderMock.hash).toHaveBeenCalledWith('NewPassword!123');
            expect(revokeSessionsSpy).toHaveBeenCalledWith(user.id);

            const expectedHashedToken = hashToken('current-refresh-token');
            expect(revokeRefreshSpy).toHaveBeenCalledWith(user.id, expectedHashedToken);

            expect(result).toHaveProperty('accessToken', 'access-token-jwt-123');
            expect(result.user).not.toHaveProperty('passwordHash');
        });

        it('deve revogar absolutamente todos os refresh tokens caso o cookie não seja enviado (fallback de segurança)', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'old-hashed-password',
            });

            hashProviderMock.compare.mockResolvedValue(true);
            const revokeRefreshSpy = vi.spyOn(refreshTokenRepository, 'revokeAllTokensByUser');

            await authService.changeAuthenthicatedUserPassword(
                user.id,
                'NewPassword!123',
                undefined as any, // Sem cookie anexado
                'OldPassword!123',
            );

            // Confirma que não repassou o token hash, ordenando um logout total
            expect(revokeRefreshSpy).toHaveBeenCalledWith(user.id);
        });

        it('deve lançar AppError se a senha antiga for incorreta', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'old-hashed-password',
            });

            hashProviderMock.compare.mockResolvedValue(false);

            await expect(authService.changeAuthenthicatedUserPassword(user.id, 'NewPassword!123', 'current-refresh-token', 'WrongOldPassword!123')).rejects.toBeInstanceOf(
                AppError,
            );
        });
    });

    describe('RevokeSessionsService', () => {
        it('deve realizar logout global quando keepCurrentSession for false', async () => {
            const user = await usersRepository.create({ firstName: 'John', lastName: 'Doe', email: 'john@example.com', passwordHash: 'hash' });
            await refreshTokenRepository.create(user.id, hashToken('token-1'), new Date(Date.now() + 86400000), '127', 'SP', 'SP', 'BR', 'Win', 'Desk');

            const result = await authService.revokeSessionsService(user.id, false);

            expect(result.accessToken).toBeNull();
            expect(refreshTokenRepository.items.every((t) => t.revokedAt !== null)).toBe(true);
        });
    });
});
