import { AppError } from '@/app/exceptions/AppError';
import { IAuthRateLimiter } from '@/app/http/middlewares/rate-limiter.middleware';
import { IGeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { IUserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { IUserSessionsRevocationProvider } from '@/app/infra/user-sessions-revocation/UserSessionsRevocationProvider';
import { hashToken } from '@/app/utils/hash-token';
import { env } from '@/env';
import { makeCreateUser } from '@/modules/users/tests/factories/users.factory';
import { InMemoryUsersRepository } from '@/modules/users/tests/repositories/in-memory-users.repository';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationService } from '../authentication.service';
import { AuthenticateUserDTO } from '../schemas/authentication.schemas';
import { InMemoryLoginAttemptsRepository } from './repositories/in-memory-login-attempts.repository';
import { InMemoryRefreshTokensRepository } from './repositories/in-memory-refresh-tokens.repository';

const IP = '203.0.113.10';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const LOCATION_INFO = { city: 'São Paulo', region: 'SP', country: 'BR' };
const DEVICE_INFO = { browser: 'Chrome', os: 'Windows', deviceType: 'desktop' };
const loginDTO: AuthenticateUserDTO = { email: 'ghost@example.com', password: 'password123' };

describe('loginUser', () => {
    let authenticationService: AuthenticationService;

    let usersRepository: InMemoryUsersRepository;
    let refreshTokensRepository: InMemoryRefreshTokensRepository;
    let loginAttemptsRepository: InMemoryLoginAttemptsRepository;

    let hashProvider: IHashProvider;
    let tokenProvider: ITokenProvider;
    let geolocationProvider: IGeolocationProvider;
    let userAgentProvider: IUserAgentProvider;
    let userSessionsRevocationProvider: IUserSessionsRevocationProvider;
    let authRateLimiter: IAuthRateLimiter;

    beforeEach(() => {
        usersRepository = new InMemoryUsersRepository();
        refreshTokensRepository = new InMemoryRefreshTokensRepository();
        loginAttemptsRepository = new InMemoryLoginAttemptsRepository();

        hashProvider = {
            hash: vi.fn(),
            compare: vi.fn(),
        };
        tokenProvider = {
            decode: vi.fn(),
            verify: vi.fn(),
            generate: vi.fn(),
            generateEmailConfirmationToken: vi.fn(),
            generatePasswordResetToken: vi.fn(),
            verifyEmailConfirmationToken: vi.fn(),
            verifyPasswordResetToken: vi.fn(),
        };
        geolocationProvider = {
            lookup: vi.fn().mockReturnValue(LOCATION_INFO),
        };
        userAgentProvider = {
            parse: vi.fn().mockReturnValue(DEVICE_INFO),
        };
        userSessionsRevocationProvider = {
            getRevokedAt: vi.fn(),
            revokeAllTokens: vi.fn(),
        };
        authRateLimiter = {
            resetLoginLimits: vi.fn(),
        };

        authenticationService = new AuthenticationService(
            usersRepository,
            refreshTokensRepository,
            loginAttemptsRepository,
            hashProvider,
            tokenProvider,
            geolocationProvider,
            userAgentProvider,
            userSessionsRevocationProvider,
            authRateLimiter,
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('[method]: #loginUser', async () => {
        it('deve consultar geolocalização e dispositivo mesmo quando o usuário não existe', async () => {
            const spyGeo = vi.spyOn(geolocationProvider, 'lookup');
            const spyUserAgent = vi.spyOn(userAgentProvider, 'parse');

            await expect(authenticationService.loginUser(loginDTO, IP, USER_AGENT)).rejects.toThrow(AppError);
            expect(spyGeo).toHaveBeenCalledWith(IP);
            expect(spyUserAgent).toHaveBeenCalledWith(USER_AGENT);
        });

        it('deve comparar contra o DUMMY_HASH (mitigação de timing attack) quando o usuário não existe', async () => {
            const spyHash = vi.spyOn(hashProvider, 'compare');
            await expect(authenticationService.loginUser(loginDTO, IP, USER_AGENT)).rejects.toThrow(AppError);
            expect(spyHash).toHaveBeenCalledWith(loginDTO.password, env.DUMMY_HASH);
        });

        it('deve registrar tentativa de falha e lançar 401 quando o usuário não existe', async () => {
            const spyLoginAttempt = vi.spyOn(loginAttemptsRepository, 'generateAttempt');
            await expect(authenticationService.loginUser(loginDTO, IP, USER_AGENT)).rejects.toThrow(AppError);
            await expect(authenticationService.loginUser(loginDTO, IP, USER_AGENT)).rejects.toMatchObject({
                statusCode: 401,
                message: 'E-mail ou senha inválidos.',
            });
            expect(spyLoginAttempt).toHaveBeenCalledWith(
                'fail',
                IP,
                LOCATION_INFO.city,
                LOCATION_INFO.region,
                LOCATION_INFO.country,
                DEVICE_INFO.os,
                DEVICE_INFO.deviceType,
                'ghost@example.com',
                undefined,
            );
        });

        it('deve registrar tentativa de falha e lançar 401 quando a senha está incorreta', async () => {
            const createdUser = await usersRepository.create({ firstName: 'Jhon', lastName: 'Doe', email: 'ghost@example.com', passwordHash: 'any-password' });

            await expect(authenticationService.loginUser({ email: createdUser.email, password: 'wrong-password' }, IP, USER_AGENT)).rejects.toThrow(AppError);
            await expect(authenticationService.loginUser({ email: createdUser.email, password: 'wrong-password' }, IP, USER_AGENT)).rejects.toMatchObject({
                statusCode: 401,
                message: 'E-mail ou senha inválidos.',
            });
        });

        it('deve usar a mesma mensagem de erro para usuário inexistente e senha errada (anti user-enumeration)', async () => {
            const createdUser = await usersRepository.create({ firstName: 'Jhon', lastName: 'Doe', email: 'test@example.com', passwordHash: 'any-password' });

            await expect(authenticationService.loginUser(loginDTO, IP, USER_AGENT)).rejects.toThrow(AppError);
            await expect(authenticationService.loginUser(loginDTO, IP, USER_AGENT)).rejects.toMatchObject({
                statusCode: 401,
                message: 'E-mail ou senha inválidos.',
            });

            await expect(authenticationService.loginUser({ email: createdUser.email, password: 'wrong-password' }, IP, USER_AGENT)).rejects.toThrow(AppError);
            await expect(authenticationService.loginUser({ email: createdUser.email, password: 'wrong-password' }, IP, USER_AGENT)).rejects.toMatchObject({
                statusCode: 401,
                message: 'E-mail ou senha inválidos.',
            });
        });

        it('deve lançar 401 quando a senha confere mas o e-mail não está confirmado, sem registrar tentativa', async () => {
            const createdUser = await usersRepository.create(makeCreateUser());

            vi.spyOn(hashProvider, 'compare').mockResolvedValue(true);

            await expect(authenticationService.loginUser({ email: createdUser.email, password: 'any-password' }, IP, USER_AGENT)).rejects.toThrow(AppError);
            await expect(authenticationService.loginUser({ email: createdUser.email, password: 'any-password' }, IP, USER_AGENT)).rejects.toMatchObject({
                statusCode: 401,
                message: 'E-mail ou senha inválidos.',
            });

            expect(loginAttemptsRepository.items).toHaveLength(0);
        });

        it('deve efetuar login com sucesso: gerar tokens, atualizar lastLogin, registrar sucesso e resetar rate limit', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            vi.spyOn(hashProvider, 'compare').mockResolvedValue(true);
            vi.spyOn(tokenProvider, 'generate').mockReturnValue('access-token-123');
            const spyTokenGenerate = vi.spyOn(tokenProvider, 'generate');
            const spyRefreshTokenRepository = vi.spyOn(refreshTokensRepository, 'create');
            const spyUsersRepository = vi.spyOn(usersRepository, 'updateLastLogin');
            const spyLoginAttemptsRepository = vi.spyOn(loginAttemptsRepository, 'generateAttempt');
            const spyAuthRateLimiter = vi.spyOn(authRateLimiter, 'resetLoginLimits');

            const result = await authenticationService.loginUser({ email: createdUser.email, password: 'any-password' }, IP, USER_AGENT);

            expect(spyTokenGenerate).toHaveBeenCalledWith(createdUser.id);
            expect(spyRefreshTokenRepository).toHaveBeenCalledWith(
                createdUser.id,
                expect.any(String),
                expect.any(Date),
                IP,
                LOCATION_INFO.city,
                LOCATION_INFO.region,
                LOCATION_INFO.country,
                DEVICE_INFO.os,
                DEVICE_INFO.deviceType,
            );
            expect(spyUsersRepository).toHaveBeenCalledWith(createdUser.id, expect.any(Date));
            expect(spyLoginAttemptsRepository).toHaveBeenCalledWith(
                'success',
                IP,
                LOCATION_INFO.city,
                LOCATION_INFO.region,
                LOCATION_INFO.country,
                DEVICE_INFO.os,
                DEVICE_INFO.deviceType,
                createdUser.email,
                createdUser.id,
            );
            expect(spyAuthRateLimiter).toHaveBeenCalledWith(IP, createdUser.email);
            expect(result.accessToken).toBe('access-token-123');
            expect(result.refreshToken).toEqual(expect.any(String));
            expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
        });

        it('não deve incluir o passwordHash no usuário retornado após login', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            vi.spyOn(hashProvider, 'compare').mockResolvedValue(true);

            const result = await authenticationService.loginUser({ email: createdUser.email, password: 'any-password' }, IP, USER_AGENT);

            expect(result.user).not.toHaveProperty('passwordHash');
        });

        it('deve calcular refreshTokenExpiresAt como REFRESH_TOKEN_EXPIRES_AT dias a partir de agora', async () => {
            const now = new Date('2026-03-10T12:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            vi.spyOn(hashProvider, 'compare').mockResolvedValue(true);

            const result = await authenticationService.loginUser({ email: createdUser.email, password: 'any-password' }, IP, USER_AGENT);

            const expected = new Date(now);
            expected.setDate(expected.getDate() + env.REFRESH_TOKEN_EXPIRES_AT);
            expect(result.refreshTokenExpiresAt).toEqual(expected);
        });
    });

    describe('[method]: #refresh', async () => {
        it('deve lançar 401 quando o token bruto está vazio', async () => {
            await expect(authenticationService.refresh('', IP, USER_AGENT)).rejects.toMatchObject({
                message: 'Refresh token não encontrado.',
                statusCode: 401,
            });
        });

        it('deve lançar 401 quando o token não é encontrado no repositório', async () => {
            vi.spyOn(refreshTokensRepository, 'findByTokenHash').mockResolvedValue(null);

            await expect(authenticationService.refresh('raw-token', IP, USER_AGENT)).rejects.toMatchObject({
                message: 'Refresh token não encontrado.',
                statusCode: 401,
            });
        });

        it('deve lançar 401 quando o token está expirado', async () => {
            const now = new Date('2026-03-10T12:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const expiredDate = new Date(now.getTime() - 1000);
            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);

            await refreshTokensRepository.create('user-1', hashedToken, expiredDate, IP, null, null, null, null, null);

            await expect(authenticationService.refresh(rawToken, IP, USER_AGENT)).rejects.toMatchObject({
                statusCode: 401,
                message: 'Refresh token expirado.',
            });
        });

        it('não deve lançar erro de expiração quando expiresAt é exatamente igual a agora (limite não expirado)', async () => {
            const now = new Date('2026-05-01T10:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            const tokenRecord = await refreshTokensRepository.create('user-1', hashedToken, now, IP, null, null, null, null, null);
            refreshTokensRepository.findByTokenHash = vi.fn().mockResolvedValue(tokenRecord);

            await expect(authenticationService.refresh('raw-token', IP, USER_AGENT)).resolves.toBeDefined();
        });

        it('REUSE DETECTION: deve revogar TODAS as sessões e lançar 401 se o token foi revogado e PASSOU do Grace Period', async () => {
            const now = new Date('2026-03-10T12:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const expDate = new Date(now.getTime() + 100000);
            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            await refreshTokensRepository.create('user-1', hashedToken, expDate, IP, null, null, null, null, null);

            // Simulamos a revogação muito além do GRACE_PERIOD_SECONDS (ex: 30 segundos atrás)
            const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
            refreshTokensRepository.items[0].revokedAt = thirtySecondsAgo;

            const spyRevokeAll = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');
            const spySessionRevoke = vi.spyOn(userSessionsRevocationProvider, 'revokeAllTokens');

            await expect(authenticationService.refresh(rawToken, IP, USER_AGENT)).rejects.toMatchObject({
                statusCode: 401,
                message: 'Sessão comprometida. Faça login novamente.',
            });

            expect(spyRevokeAll).toHaveBeenCalledWith('user-1');
            expect(spySessionRevoke).toHaveBeenCalledWith('user-1');
        });

        it('GRACE PERIOD: deve suprimir rotação (retornar newRawRefreshToken null) se o token foi revogado HÁ POUCOS SEGUNDOS (corrida de rede)', async () => {
            const now = new Date('2026-03-10T12:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const expDate = new Date(now.getTime() + 100000);
            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            await refreshTokensRepository.create('user-1', hashedToken, expDate, IP, null, null, null, null, null);

            // Simulamos a revogação DENTRO do Grace Period (ex: 5 segundos atrás)
            const fiveSecondsAgo = new Date(now.getTime() - 5 * 1000);
            refreshTokensRepository.items[0].revokedAt = fiveSecondsAgo;

            vi.spyOn(tokenProvider, 'generate').mockReturnValue('new-access-token');

            const result = await authenticationService.refresh(rawToken, IP, USER_AGENT);

            expect(result.accessToken).toBe('new-access-token');
            expect(result.refreshToken).toBeNull();
            expect(result.expiresAt).toBeNull();
        });

        it('GRACE PERIOD: deve tolerar reuso exatamente no limite do grace period (diffInSeconds === GRACE_PERIOD_SECONDS)', async () => {
            const now = new Date('2026-03-10T12:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const expDate = new Date(now.getTime() + 100000);
            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            await refreshTokensRepository.create('user-1', hashedToken, expDate, IP, null, null, null, null, null);

            // Simulamos a revogação DENTRO do limite do Grace Period
            const fiveSecondsAgo = new Date(now.getTime() - env.GRACE_PERIOD_SECONDS * 1000);
            refreshTokensRepository.items[0].revokedAt = fiveSecondsAgo;

            vi.spyOn(tokenProvider, 'generate').mockReturnValue('new-access-token');

            const result = await authenticationService.refresh(rawToken, IP, USER_AGENT);

            expect(result.accessToken).toBe('new-access-token');
            expect(result.refreshToken).toBeNull();
            expect(result.expiresAt).toBeNull();
        });

        it('deve realizar a rotação de tokens com sucesso em um cenário normal, executando a transação atômica', async () => {
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + 7);

            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            const tokenId = await refreshTokensRepository.create('user-1', hashedToken, expDate, IP, null, null, null, null, null);

            vi.spyOn(tokenProvider, 'generate').mockReturnValue('new-access-token');
            const spyRevokeToken = vi.spyOn(refreshTokensRepository, 'revokeToken');
            const spyCreateToken = vi.spyOn(refreshTokensRepository, 'create');

            const result = await authenticationService.refresh(rawToken, IP, USER_AGENT);

            expect(spyRevokeToken).toHaveBeenCalledWith(tokenId, expect.anything());
            expect(spyCreateToken).toHaveBeenCalledWith(
                'user-1',
                expect.any(String),
                expect.any(Date),
                IP,
                LOCATION_INFO.city,
                LOCATION_INFO.region,
                LOCATION_INFO.country,
                DEVICE_INFO.os,
                DEVICE_INFO.deviceType,
                expect.anything(),
            );

            expect(result.accessToken).toBe('new-access-token');
            expect(result.refreshToken).toBeTypeOf('string');
            expect(result.expiresAt).toBeInstanceOf(Date);
        });

        it('deve calcular a expiração do novo refresh token como REFRESH_TOKEN_EXPIRES_AT dias a partir de agora, na rotação', async () => {
            const now = new Date('2026-06-15T08:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const expDate = new Date(now.getTime() + 1000 * 60 * 60);
            await refreshTokensRepository.create('user-1', hashToken('raw-token-123'), expDate, IP, null, null, null, null, null);
            const result = await authenticationService.refresh('raw-token-123', IP, USER_AGENT);

            const expected = new Date(now);
            expected.setDate(expected.getDate() + env.REFRESH_TOKEN_EXPIRES_AT);
            expect(result.expiresAt).toEqual(expected);
        });
    });

    describe('createResetPassword', () => {
        it('deve pagar o custo do hash (simulateHashDelay) mesmo quando o e-mail não existe', async () => {
            await authenticationService.createResetPassword('ghost@example.com');

            expect(hashProvider.hash).toHaveBeenCalledWith(env.DUMMY_HASH);
        });

        it('não deve gerar token de reset quando o e-mail não existe, retornando silenciosamente', async () => {
            await expect(authenticationService.createResetPassword('ghost@example.com')).resolves.toBeUndefined();
            expect(tokenProvider.generatePasswordResetToken).not.toHaveBeenCalled();
        });

        it('deve pagar o custo do hash e gerar o token de reset quando o e-mail existe', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            await authenticationService.createResetPassword(createdUser.email);

            expect(hashProvider.hash).toHaveBeenCalledWith(env.DUMMY_HASH);
            expect(tokenProvider.generatePasswordResetToken).toHaveBeenCalledWith(createdUser.id, createdUser.passwordHash, createdUser.lastLoginAt);
        });

        // Cuidado com esse teste caso você mude a forma de mostrar esse token
        it('deve logar o token no console apenas em ambiente de desenvolvimento', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
            (env as { NODE_ENV: string }).NODE_ENV = 'development';
            await authenticationService.createResetPassword(createdUser.email);
            expect(logSpy).toHaveBeenCalled();

            logSpy.mockClear();

            (env as { NODE_ENV: string }).NODE_ENV = 'production';
            await authenticationService.createResetPassword(createdUser.email);
            expect(logSpy).not.toHaveBeenCalled();
        });
    });

    describe('resetPassword', () => {
        it('deve lançar 404 quando o usuário do token decodificado não existe', async () => {
            vi.spyOn(tokenProvider, 'decode').mockReturnValue({ sub: 'missing-user' });
            const spyUsersRepository = vi.spyOn(usersRepository, 'findById');

            await expect(authenticationService.resetPassword('token', 'NewPass@123')).rejects.toMatchObject({
                message: 'Usuário inexistente.',
                statusCode: 404,
            });

            expect(spyUsersRepository).toHaveBeenCalledWith('missing-user');
        });

        it('deve lançar 401 quando a verificação do token de reset falha (assinatura/expiração)', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            vi.spyOn(tokenProvider, 'decode').mockReturnValue({ sub: createdUser.id });
            vi.spyOn(tokenProvider, 'verifyPasswordResetToken').mockImplementation(() => {
                throw new Error('jwt expired');
            });

            await expect(authenticationService.resetPassword('token', 'NewPass@123')).rejects.toMatchObject({
                message: 'Token inválido e/ou expirado. Faça uma nova solicitação de token.',
                statusCode: 401,
            });
        });

        it('deve verificar o token com o passwordHash e lastLoginAt atuais do usuário', async () => {
            const createdUser = await usersRepository.create(
                makeCreateUser({ passwordHash: 'any-password', isEmailConfirmed: true, lastLoginAt: new Date('2026-02-01T00:00:00.000Z') }),
            );

            vi.spyOn(tokenProvider, 'decode').mockReturnValue({ sub: createdUser.id });
            vi.spyOn(usersRepository, 'findById').mockResolvedValue(createdUser);
            await authenticationService.resetPassword('reset-token', 'NewPass@123');

            expect(tokenProvider.verifyPasswordResetToken).toHaveBeenCalledWith('reset-token', 'any-password', createdUser.lastLoginAt);
        });

        it('deve atualizar a senha e revogar todas as sessões e refresh tokens do usuário com sucesso', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));
            await usersRepository.updateLastLogin(createdUser.id, new Date('2026-02-01T00:00:00.000Z'));

            vi.spyOn(tokenProvider, 'decode').mockReturnValue({ sub: createdUser.id });
            vi.spyOn(tokenProvider, 'verifyPasswordResetToken').mockReturnValue({ sub: createdUser.id });
            vi.spyOn(hashProvider, 'hash').mockResolvedValue('new-hashed-password');

            const spyUpdatePassword = vi.spyOn(usersRepository, 'updatePassword');
            const spyRevokeAccess = vi.spyOn(userSessionsRevocationProvider, 'revokeAllTokens');
            const spyRevokeRefresh = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');

            await authenticationService.resetPassword('reset-token', 'NewPass@123');

            expect(hashProvider.hash).toHaveBeenCalledWith('NewPass@123');
            expect(spyUpdatePassword).toHaveBeenCalledWith(createdUser.id, 'new-hashed-password', createdUser.isEmailConfirmed);
            expect(spyRevokeAccess).toHaveBeenCalledWith(createdUser.id);
            expect(spyRevokeRefresh).toHaveBeenCalledWith(createdUser.id);
        });
    });

    describe('changeAuthenticatedUserPassword', () => {
        it('deve lançar 401 quando o usuário autenticado não é encontrado no banco', async () => {
            await expect(authenticationService.changeAuthenticatedUserPassword('user-1', 'NewPass@123', 'refresh-token', 'oldPass')).rejects.toMatchObject({
                message: 'E-mail ou senha inválidos.',
                statusCode: 401,
            });
        });

        it('deve lançar 401 quando o usuário autenticado não é encontrado no banco', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            vi.spyOn(usersRepository, 'findById').mockResolvedValue(createdUser);
            vi.spyOn(hashProvider, 'compare').mockResolvedValue(false);

            await expect(authenticationService.changeAuthenticatedUserPassword(createdUser.id, createdUser.passwordHash, 'refresh-token', 'oldPass')).rejects.toMatchObject({
                message: 'A senha atual está errada.',
                statusCode: 401,
            });
        });

        it('deve revogar todas as sessões, exceto a atual, quando currentRefreshToken é informado', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            vi.spyOn(usersRepository, 'findById').mockResolvedValue(createdUser);
            vi.spyOn(hashProvider, 'compare').mockResolvedValue(true);

            const spyUserSessionsRevocationProvider = vi.spyOn(userSessionsRevocationProvider, 'revokeAllTokens');
            const spyRefreshTokensRepository = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');
            await authenticationService.changeAuthenticatedUserPassword(createdUser.id, 'NewPass@123', 'my-current-refresh-token', 'correct-old-password');

            expect(spyUserSessionsRevocationProvider).toHaveBeenCalledWith(createdUser.id);
            expect(spyRefreshTokensRepository).toHaveBeenCalledWith(createdUser.id, expect.any(String));
        });

        it('deve revogar literalmente todas as sessões quando currentRefreshToken não é informado', async () => {
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            vi.spyOn(usersRepository, 'findById').mockResolvedValue(createdUser);
            vi.spyOn(hashProvider, 'compare').mockResolvedValue(true);

            const spyRefreshTokensRepository = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');
            await authenticationService.changeAuthenticatedUserPassword(createdUser.id, 'NewPass@123', '', 'correct-old-password');

            expect(spyRefreshTokensRepository).toHaveBeenCalledWith(createdUser.id);
            expect(spyRefreshTokensRepository).not.toHaveBeenCalledWith(createdUser.id, expect.any(String));
        });

        it('deve atualizar a senha sem forçar isEmailConfirmed, revogar sessões antigas e retornar o usuário atualizado com novo access token', async () => {
            // 1. Criamos o usuário real no banco em memória
            const createdUser = await usersRepository.create(makeCreateUser({ isEmailConfirmed: true }));

            // 2. Setup dos Provedores Externos (Usando o spyOn na própria declaração)
            vi.spyOn(hashProvider, 'compare').mockResolvedValue(true);
            const spyHashProvider = vi.spyOn(hashProvider, 'hash').mockResolvedValue('new-hashed-password');
            const spyTokenProvider = vi.spyOn(tokenProvider, 'generate').mockReturnValue('new-access-token-after-change');

            // 3. Setup dos Espiões de Banco
            const spyUsersRepository = vi.spyOn(usersRepository, 'updatePassword');
            const spyRevokeAccess = vi.spyOn(userSessionsRevocationProvider, 'revokeAllTokens');
            const spyRevokeRefresh = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');

            // 4. Execução
            const currentRawToken = 'refresh-token-atual';
            const result = await authenticationService.changeAuthenticatedUserPassword(createdUser.id, 'NewPass@123', currentRawToken, 'correct-old-password');

            // 5. Asserções de Fluxo e Banco
            expect(spyHashProvider).toHaveBeenCalledWith('NewPass@123');
            expect(spyUsersRepository).toHaveBeenCalledWith(createdUser.id, 'new-hashed-password');
            expect(spyTokenProvider).toHaveBeenCalledWith(createdUser.id);

            // Verifica se matou as sessões de segurança, preservando apenas a atual (passando o hash na exceção)
            expect(spyRevokeAccess).toHaveBeenCalledWith(createdUser.id);
            expect(spyRevokeRefresh).toHaveBeenCalledWith(createdUser.id, expect.any(String));

            // 6. Asserções de Retorno
            expect(result.accessToken).toBe('new-access-token-after-change');
            expect(result.user.id).toBe(createdUser.id);
            expect(result.user).not.toHaveProperty('passwordHash'); // Garante que a senha nova não vazou no retorno
        });
    });

    describe('[method]: #revokeByRawToken', () => {
        it('deve lançar 401 quando o token não é encontrado', async () => {
            // Não precisamos mockar! O banco em memória já está vazio, então ele não vai achar naturalmente.
            await expect(authenticationService.revokeByRawToken('raw-token-fake')).rejects.toMatchObject({
                message: 'Refresh token não encontrado.',
                statusCode: 401,
            });
        });

        it('deve revogar o token normalmente quando ele ainda está ativo (fluxo padrão de logout)', async () => {
            // 1. Criamos o token real no banco em memória
            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            const tokenId = await refreshTokensRepository.create('user-1', hashedToken, new Date(), IP, null, null, null, null, null);

            // 2. Criamos os espiões com os nomes corretos
            const spyRevokeToken = vi.spyOn(refreshTokensRepository, 'revokeToken');
            const spyRevokeAllTokensByUser = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');

            await authenticationService.revokeByRawToken(rawToken);

            expect(spyRevokeToken).toHaveBeenCalledWith(tokenId); // Passamos o ID real retornado pela criação
            expect(spyRevokeAllTokensByUser).not.toHaveBeenCalled();
        });

        it('não deve re-revogar (nem lançar erro) quando o token já revogado está dentro do grace period', async () => {
            const now = new Date('2026-07-01T09:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // 1. Criamos o token e adulteramos a data de revogação direto no banco em memória (5s atrás)
            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            await refreshTokensRepository.create('user-1', hashedToken, new Date(now.getTime() + 100000), IP, null, null, null, null, null);
            refreshTokensRepository.items[0].revokedAt = new Date(now.getTime() - 5 * 1000);

            const spyRevokeToken = vi.spyOn(refreshTokensRepository, 'revokeToken');
            const spyRevokeAllTokensByUser = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');

            // Deve passar silenciosamente
            await expect(authenticationService.revokeByRawToken(rawToken)).resolves.toBeUndefined();

            expect(spyRevokeToken).not.toHaveBeenCalled();
            expect(spyRevokeAllTokensByUser).not.toHaveBeenCalled();
        });

        it('deve tolerar exatamente no limite do grace period (diffInSeconds === GRACE_PERIOD_SECONDS)', async () => {
            const now = new Date('2026-07-01T09:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            await refreshTokensRepository.create('user-1', hashedToken, new Date(now.getTime() + 100000), IP, null, null, null, null, null);

            // Extremo do limite do Grace Period
            refreshTokensRepository.items[0].revokedAt = new Date(now.getTime() - env.GRACE_PERIOD_SECONDS * 1000);

            const spyRevokeToken = vi.spyOn(refreshTokensRepository, 'revokeToken');
            const spyRevokeAllTokensByUser = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');

            await expect(authenticationService.revokeByRawToken(rawToken)).resolves.toBeUndefined();

            expect(spyRevokeToken).not.toHaveBeenCalled();
            expect(spyRevokeAllTokensByUser).not.toHaveBeenCalled();
        });

        it('deve revogar todas as sessões do usuário e lançar 401 quando o reuso ocorre além do grace period', async () => {
            const now = new Date('2026-07-01T09:00:00.000Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            const rawToken = 'raw-token-123';
            const hashedToken = hashToken(rawToken);
            await refreshTokensRepository.create('user-stolen', hashedToken, new Date(now.getTime() + 100000), IP, null, null, null, null, null);

            // Mais de 20s atrás (excedeu o grace period)
            refreshTokensRepository.items[0].revokedAt = new Date(now.getTime() - (env.GRACE_PERIOD_SECONDS + 1) * 1000);

            const spyRevokeToken = vi.spyOn(refreshTokensRepository, 'revokeToken');
            const spyRevokeAllTokensByUser = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');

            // ATENÇÃO AQUI: O revokeAllTokens global de acesso é do Provider, não do repositório
            const spyRevokeAllAccessTokens = vi.spyOn(userSessionsRevocationProvider, 'revokeAllTokens');

            // ATENÇÃO AQUI: Expect no método do Service
            await expect(authenticationService.revokeByRawToken(rawToken)).rejects.toMatchObject({
                message: 'Refresh token inválido ou já utilizado.',
                statusCode: 401,
            });

            expect(spyRevokeAllTokensByUser).toHaveBeenCalledWith('user-stolen');
            expect(spyRevokeAllAccessTokens).toHaveBeenCalledWith('user-stolen');
            expect(spyRevokeToken).not.toHaveBeenCalled();
        });
    });

    describe('revokeSessionsService', () => {
        it('deve sempre revogar todos os access tokens (sessões) do usuário primeiro, independentemente dos parâmetros', async () => {
            const spyRevokeAllAccessTokens = vi.spyOn(userSessionsRevocationProvider, 'revokeAllTokens');
            await authenticationService.revokeSessionsService('user-1', false);

            expect(spyRevokeAllAccessTokens).toHaveBeenCalledWith('user-1');
        });

        it('deve manter apenas a sessão atual viva quando keepCurrentSession=true e currentRefreshToken é informado', async () => {
            const spyTokenProvider = vi.spyOn(tokenProvider, 'generate').mockReturnValue('preserved-session-token');
            const spyRefreshTokenRepository = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');

            const result = await authenticationService.revokeSessionsService('user-1', true, 'current-raw-refresh-token');

            expect(spyRefreshTokenRepository).toHaveBeenCalledWith('user-1', expect.any(String));
            expect(spyTokenProvider).toHaveBeenCalledWith('user-1');
            expect(result).toEqual({ accessToken: 'preserved-session-token' });
        });

        it('deve cair no logout global quando keepCurrentSession=true mas currentRefreshToken não é informado', async () => {
            const spyRefreshTokenRepository = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');
            const spyTokenProvider = vi.spyOn(tokenProvider, 'generate');

            const result = await authenticationService.revokeSessionsService('user-1', true, undefined);

            expect(spyRefreshTokenRepository).toHaveBeenCalledWith('user-1');
            expect(spyTokenProvider).not.toHaveBeenCalledWith('user-1', expect.any(String));
            expect(tokenProvider.generate).not.toHaveBeenCalled();
            expect(result).toEqual({ accessToken: null });
        });

        it('deve destruir todos os refresh tokens quando keepCurrentSession=false, mesmo se currentRefreshToken for informado', async () => {
            const spyRefreshTokenRepository = vi.spyOn(refreshTokensRepository, 'revokeAllTokensByUser');
            const spyTokenProvider = vi.spyOn(tokenProvider, 'generate');

            const result = await authenticationService.revokeSessionsService('user-1', false, 'some-refresh-token');

            expect(spyRefreshTokenRepository).toHaveBeenCalledWith('user-1');
            expect(spyTokenProvider).not.toHaveBeenCalledWith('user-1', expect.any(String));
            expect(tokenProvider.generate).not.toHaveBeenCalled();
            expect(result).toEqual({ accessToken: null });
        });
    });
});
