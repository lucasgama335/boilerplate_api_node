/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/app/exceptions/AppError';
import { InMemoryUserSessionsRevocationProvider } from '@/app/infra/user-sessions-revocation/fakes/fake-user-sessions-revocation-provider';
import { InMemoryUserRepository } from '@/modules/users/fakes/fake-users.repository';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationUserService } from '../authentication.service';
import { InMemoryLoginAttemptsRepository } from '../fakes/fake-login-attempts.repository';
import { InMemoryRefreshTokenRepository } from '../fakes/fake-refresh-tokens.repository';

describe('Authentication Service (Unit Test)', () => {
    let authService: AuthenticationUserService;
    let usersRepository: InMemoryUserRepository;
    let loginAttemptsRepository: InMemoryLoginAttemptsRepository;
    let refreshTokenRepository: InMemoryRefreshTokenRepository;
    let userSessionRevocationProvider: InMemoryUserSessionsRevocationProvider;

    let hashProviderMock: any;
    let tokenProviderMock: any;
    let geolocationProviderMock: any;
    let userAgentProviderMock: any;

    beforeEach(() => {
        usersRepository = new InMemoryUserRepository();
        loginAttemptsRepository = new InMemoryLoginAttemptsRepository();
        refreshTokenRepository = new InMemoryRefreshTokenRepository();
        userSessionRevocationProvider = new InMemoryUserSessionsRevocationProvider(usersRepository);

        hashProviderMock = {
            compare: vi.fn(),
            hash: vi.fn().mockResolvedValue('hashed-password-result'),
        };

        tokenProviderMock = {
            generate: vi.fn().mockReturnValue('access-token-jwt-123'),
            generatePasswordResetToken: vi.fn().mockReturnValue('reset-token-xyz'),
            verifyPasswordResetToken: vi.fn(),
            decode: vi.fn(),
        };

        geolocationProviderMock = {
            lookup: vi.fn().mockReturnValue({ city: 'São Paulo', region: 'SP', country: 'Brazil' }),
        };

        userAgentProviderMock = {
            parse: vi.fn().mockReturnValue({ os: 'Windows', deviceType: 'Desktop' }),
        };

        authService = new AuthenticationUserService(
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

    describe('createResetPassword', () => {
        it('deve gerar o token de recuperação para um usuário existente', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash-atual',
            });

            await authService.createResetPassword('john@example.com');

            expect(tokenProviderMock.generatePasswordResetToken).toHaveBeenCalledWith(user.id, 'hash-atual', null);
        });

        it('deve executar hash dummy e não lançar erro para e-mail inexistente (anti-timing attack)', async () => {
            await authService.createResetPassword('nao-existe@example.com');

            expect(hashProviderMock.hash).toHaveBeenCalled();
            expect(tokenProviderMock.generatePasswordResetToken).not.toHaveBeenCalled();
        });

        it('deve executar o hash dummy MESMO quando o usuário existe (equaliza o tempo de resposta)', async () => {
            await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash-atual',
            });

            await authService.createResetPassword('john@example.com');

            // Este é o teste que teria pego o bug: antes, o hash só rodava
            // quando o usuário NÃO existia, invertendo a mitigação de timing.
            expect(hashProviderMock.hash).toHaveBeenCalled();
        });
    });

    describe('resetPassword', () => {
        it('deve redefinir a senha e revogar todas as sessões e refresh tokens do usuário', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash-antigo',
            });

            tokenProviderMock.decode.mockReturnValue({ sub: user.id });
            tokenProviderMock.verifyPasswordResetToken.mockReturnValue({ sub: user.id });

            const revokeSessionsSpy = vi.spyOn(userSessionRevocationProvider, 'revokeAllTokens');
            const revokeRefreshSpy = vi.spyOn(refreshTokenRepository, 'revokeAllTokensByUser');

            await authService.resetPassword('valid-reset-token', 'NewPassword!123');

            expect(hashProviderMock.hash).toHaveBeenCalledWith('NewPassword!123');
            expect(revokeSessionsSpy).toHaveBeenCalledWith(user.id);
            expect(revokeRefreshSpy).toHaveBeenCalledWith(user.id);

            const updatedUser = await usersRepository.findById(user.id, true);
            expect(updatedUser?.passwordHash).toBe('hashed-password-result');
        });

        it('deve lançar AppError 404 se o usuário contido no token não existir', async () => {
            tokenProviderMock.decode.mockReturnValue({ sub: 'user-id-inexistente' });

            await expect(authService.resetPassword('valid-reset-token', 'NewPassword!123')).rejects.toMatchObject(new AppError('Usuário inexistente.', 404));
        });

        it('deve lançar AppError 401 se a verificação do token falhar (expirado ou assinatura desalinhada)', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'hash-antigo',
            });

            tokenProviderMock.decode.mockReturnValue({ sub: user.id });
            tokenProviderMock.verifyPasswordResetToken.mockImplementation(() => {
                throw new Error('invalid token signature');
            });

            await expect(authService.resetPassword('invalid-or-expired-token', 'NewPassword!123')).rejects.toMatchObject(
                new AppError('Token inválido e/ou expirado. Faça uma nova solicitação de token.', 401),
            );
        });
    });

    describe('LoginUser', () => {
        it('deve autenticar com sucesso e registrar lastLoginAt no repositório', async () => {
            const user = await usersRepository.create({
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                passwordHash: 'valid-hashed-password',
            });

            await usersRepository.confirmEmail(user.id);

            hashProviderMock.compare.mockImplementation(async (password: string) => password === 'correct-password');

            const result = await authService.loginUser({ email: 'john@example.com', password: 'correct-password' }, '127.0.0.1', 'Mozilla/5.0');

            expect(result.token).toBe('access-token-jwt-123');
            expect(loginAttemptsRepository.items[0].status).toBe('success');

            const updatedUser = await usersRepository.findById(user.id, true);
            expect(updatedUser?.lastLoginAt).not.toBeNull();
        });
    });
});
