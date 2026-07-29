import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ⚠️ Precisa vir ANTES do import do módulo testado: `redis-client.ts` cria o
// cliente ioredis (`new Redis(...)`) assim que é importado, e `rate-limiter.middleware.ts`
// importa `redisClient` no topo do arquivo. Sem esse mock, rodar este teste tentaria
// abrir uma conexão TCP real contra o Redis configurado no .env de teste.
const redisState = { shouldFail: false };

vi.mock('ioredis', () => {
    class FakeRedis {
        on = vi.fn();
        call = vi.fn(async (..._args: unknown[]) => {
            if (redisState.shouldFail) {
                throw new Error('Redis indisponível (simulado)');
            }
            return 'OK';
        });
    }
    return { default: FakeRedis };
});

// O logger real (pino) não precisa rodar nos testes; intercepta pra não poluir o output
vi.mock('@/common/utils/logger', () => ({
    logger: { warn: vi.fn(), error: vi.fn() },
}));

describe('[UNIT TEST]: RateLimiterAdapter - resetLoginLimits', () => {
    beforeEach(() => {
        redisState.shouldFail = false;
        vi.clearAllMocks();
    });

    afterEach(() => {
        redisState.shouldFail = false;
    });

    it('deve resolver sem lançar erro quando o Redis está saudável', async () => {
        const { authRateLimiter } = await import('../rate-limiter.middleware');

        await expect(authRateLimiter.resetLoginLimits('203.0.113.10', 'user@example.com')).resolves.toBeUndefined();
    });

    it('deve resolver sem lançar erro mesmo quando o Redis está indisponível (fail-open no reset)', async () => {
        redisState.shouldFail = true;
        const { authRateLimiter } = await import('../rate-limiter.middleware');

        await expect(authRateLimiter.resetLoginLimits('203.0.113.10', 'user@example.com')).resolves.toBeUndefined();
    });

    it('deve normalizar o e-mail (trim + lowercase) antes de tentar resetar, sem lançar erro para entradas com espaços/maiúsculas', async () => {
        const { authRateLimiter } = await import('../rate-limiter.middleware');

        await expect(authRateLimiter.resetLoginLimits('203.0.113.10', '  USER@Example.COM  ')).resolves.toBeUndefined();
    });

    it('deve continuar resolvendo mesmo se o e-mail vier vazio (não deve travar o fluxo de login)', async () => {
        const { authRateLimiter } = await import('../rate-limiter.middleware');

        await expect(authRateLimiter.resetLoginLimits('203.0.113.10', '')).resolves.toBeUndefined();
    });
});
