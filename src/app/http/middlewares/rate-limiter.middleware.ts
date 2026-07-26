import { AppError } from '@/app/exceptions/AppError';
import { redisClient } from '@/app/infra/redis/redis-client';
import { logger } from '@/app/utils/logger';
import { Request, RequestHandler } from 'express';
import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, SendCommandFn } from 'rate-limit-redis';
import { withFailOpen } from './with-fail-open';

const rateLimitHandlerIP = () => {
    throw new AppError('Muitas tentativas excedidas a partir deste IP. Tente novamente mais tarde.', 429);
};

const rateLimitHandlerAccount = () => {
    throw new AppError('Muitas tentativas excedidas a partir desta conta. Tente novamente mais tarde.', 429);
};

const getAccountKey = (email: string) => email.trim().toLowerCase();

function createRedisSendCommand(): SendCommandFn {
    return (async (...args: string[]) => {
        const [command, ...rest] = args;
        try {
            return await redisClient.call(command!, ...rest);
        } catch (error: unknown) {
            if (command?.toUpperCase() === 'SCRIPT') {
                return 'dummy-sha-to-bypass-init-error';
            }
            throw error;
        }
    }) as SendCommandFn;
}

interface RateLimiterConfig {
    windowMs: number;
    max: number;
    prefix: string;
    keyGenerator?: (req: Request) => string;
    handler: () => void;
}

interface FailOpenLimiterBundle {
    middleware: RequestHandler;
    redisLimiter: RateLimitRequestHandler;
    memoryLimiter: RateLimitRequestHandler;
}

/**
 * Monta um par de rate limiters (Redis + fallback em memória) com as MESMAS regras
 * dos dois lados, e os une com fail-open: se o Redis falhar por infraestrutura,
 * cai pro limiter em memória; um 429 legítimo continua bloqueando normalmente.
 */
function createFailOpenRateLimiter(config: RateLimiterConfig, limiterName: string): FailOpenLimiterBundle {
    const baseOptions = {
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: config.keyGenerator,
        handler: config.handler,
    };

    const redisLimiter = rateLimit({
        ...baseOptions,
        store: new RedisStore({
            sendCommand: createRedisSendCommand(),
            prefix: config.prefix,
        }),
    });

    const memoryLimiter = rateLimit(baseOptions);

    return {
        middleware: withFailOpen(redisLimiter, memoryLimiter, limiterName),
        redisLimiter,
        memoryLimiter,
    };
}

const emailKeyGenerator = (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email : 'unknown';
    return getAccountKey(email);
};

const userIdKeyGenerator = (req: Request) => req.user?.id ?? 'unknown';

const WINDOW_MS = 15 * 60 * 1000;

// Auth Limiters
const loginIpLimiter = createFailOpenRateLimiter({ windowMs: WINDOW_MS, max: 10, prefix: 'rl:auth:ip:login:', handler: rateLimitHandlerIP }, 'ip-login');
const loginEmailLimiter = createFailOpenRateLimiter(
    { windowMs: WINDOW_MS, max: 5, prefix: 'rl:auth:email:login:', keyGenerator: emailKeyGenerator, handler: rateLimitHandlerAccount },
    'email-login',
);

const refreshIpLimiter = createFailOpenRateLimiter({ windowMs: WINDOW_MS, max: 30, prefix: 'rl:auth:ip:refresh:', handler: rateLimitHandlerIP }, 'ip-refresh');
const registerIpLimiter = createFailOpenRateLimiter({ windowMs: WINDOW_MS * 4, max: 5, prefix: 'rl:auth:ip:register:', handler: rateLimitHandlerIP }, 'ip-register');

// Forget Password Limiters
const forgotPasswordIpLimiter = createFailOpenRateLimiter(
    { windowMs: WINDOW_MS, max: 5, prefix: 'rl:auth:ip:forgot-password:', handler: rateLimitHandlerIP },
    'ip-forgot-password',
);
const forgotPasswordEmailLimiter = createFailOpenRateLimiter(
    { windowMs: WINDOW_MS * 4, max: 3, prefix: 'rl:auth:email:forgot-password:', keyGenerator: emailKeyGenerator, handler: rateLimitHandlerAccount },
    'email-forgot-password',
);
const resetPasswordIpLimiter = createFailOpenRateLimiter({ windowMs: WINDOW_MS, max: 10, prefix: 'rl:auth:ip:reset-password:', handler: rateLimitHandlerIP }, 'ip-reset-password');

// Confirm Email Limiters
const confirmEmailIpLimiter = createFailOpenRateLimiter({ windowMs: WINDOW_MS, max: 10, prefix: 'rl:users:ip:confirm-email:', handler: rateLimitHandlerIP }, 'ip-confirm-email');
const resendConfirmationEmailIpLimiter = createFailOpenRateLimiter(
    { windowMs: WINDOW_MS, max: 5, prefix: 'rl:users:ip:resend-confirm-email:', handler: rateLimitHandlerIP },
    'ip-resend-confirm-email',
);
const resendConfirmationEmailRequestEmailLimiter = createFailOpenRateLimiter(
    { windowMs: WINDOW_MS * 4, max: 3, prefix: 'rl:users:email:resend-confirmation-email:', keyGenerator: emailKeyGenerator, handler: rateLimitHandlerAccount },
    'email-resend-confirmation-email',
);

// Rate limit por usuário autenticado (via req.user.id), não por e-mail — usado em
// rotas como /change-password onde não existe e-mail no body. Usar o limiter de
// conta (por e-mail) aqui faria todo mundo sem e-mail no body cair na mesma chave
// 'unknown' e compartilhar um único orçamento global, o que é errado.
const changePasswordIdLimiter = createFailOpenRateLimiter(
    { windowMs: WINDOW_MS, max: 5, prefix: 'rl:users:user_id:change-password:', keyGenerator: userIdKeyGenerator, handler: rateLimitHandlerAccount },
    'user_id-change-password',
);

export const loginRequestIpLimiter = loginIpLimiter.middleware;
export const loginRequestEmailLimiter = loginEmailLimiter.middleware;
export const refreshRequestIpLimiter = refreshIpLimiter.middleware;
export const registerRequestIpLimiter = registerIpLimiter.middleware;
export const forgotPasswordRequestIpLimiter = forgotPasswordIpLimiter.middleware;
export const forgotPasswordRequestEmailLimiter = forgotPasswordEmailLimiter.middleware;
export const resetPasswordRequestIpLimiter = resetPasswordIpLimiter.middleware;
export const confirmEmailRequestIpLimiter = confirmEmailIpLimiter.middleware;
export const resendConfirmationEmailRequestIpLimiter = resendConfirmationEmailIpLimiter.middleware;
export const resendConfirmationRequestEmailLimiter = resendConfirmationEmailRequestEmailLimiter.middleware;
export const changePasswordRequestIdLimiter = changePasswordIdLimiter.middleware;

/**
 * Limpa o contador de tentativas de login (tanto de IP quanto de Conta)
 * Deve ser chamada após um login efetuado com SUCESSO.
 */
export interface IAuthRateLimiter {
    resetLoginLimits(ip: string, email: string): Promise<void>;
}

export class RateLimiterAdapter implements IAuthRateLimiter {
    constructor() {}

    async resetLoginLimits(_ip: string, email: string): Promise<void> {
        // Se um atacante estiver realizando um ataque de força bruta a partir de um IP contra múltiplos usuários,
        // e a cada 9 tentativas falhas ele fizer 1 tentativa válida usando uma conta de teste que ele mesmo criou,
        // o contador de IP será resetado. Ele contorna o bloqueio de IP indefinidamente. Assim, resetamos apenas o limite da conta.
        const formattedEmail = getAccountKey(email);

        try {
            // loginIpLimiter.redisLimiter.resetKey(ip);
            loginEmailLimiter.redisLimiter.resetKey(formattedEmail);
        } catch (error) {
            logger.warn({ err: error }, '[RateLimiter] Erro ao resetar chaves no Redis (silenciado)');
        }

        try {
            // loginIpLimiter.memoryLimiter.resetKey(ip);
            loginEmailLimiter.memoryLimiter.resetKey(formattedEmail);
        } catch (error) {
            logger.warn({ err: error }, '[RateLimiter] Erro ao resetar chaves no Fallback (silenciado)');
        }
    }
}
export const authRateLimiter: IAuthRateLimiter = new RateLimiterAdapter();
