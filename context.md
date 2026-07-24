refactor the auth module

---

# File: src\@types\express.d.ts

```typescript
// Aqui estamos falando para o typescript que todas as
// requisições agora conterão um objeto usuário que terá um parâmetro id, ou seja,
// estamos expandindo as tipagens padrão do express
declare namespace Express {
    export interface Request {
        user: {
            id: string;
        };
    }
}

```

# File: src\app\app.ts

```typescript
import { env } from '@/env';
import * as Sentry from '@sentry/node';

// Inicialize o Sentry o mais cedo possível
Sentry.init({
    dsn: env.SENTRY_DSN, // Você pega essa URL gratuita criando uma conta no Sentry.io
    environment: env.NODE_ENV || 'development',
    enableLogs: true,
    // tracesSampleRate de 1.0 captura 100% das transações para métricas de performance.
    // Em produção com alto tráfego, você pode reduzir para 0.2 (20%).
    tracesSampleRate: 1.0,
});

import { routes } from '@/routes';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { errorHandler } from './http/middlewares/error-handler-middleware';

export const app = express();

// Middlewares globais básicos
app.set('trust proxy', env.TRUST_PROXY_HOPS); // Número reais de proxys que batem na API
app.use(
    cors({
        origin: env.FRONTEND_URL, // nunca '*' quando usa cookies/credentials
        credentials: true, // permite o navegador enviar/receber cookies
    }),
);
app.use(cookieParser());
app.use(express.json()); // Permite que o Express entenda JSON no body da requisição

// Pluga o nosso Hub Central de rotas na aplicação com o prefixo '/api'
// Agora a nossa rota final será: POST /api/auth/register
app.use('/api', routes);

// O interceptador de erros sempre no final!
app.use(errorHandler);

```

# File: src\app\composition-root.ts

```typescript
// shared/composition-root.ts (ou onde você já centraliza infra compartilhada)
import { ensureAuthenticatedMiddleware } from '@/app/http/middlewares/ensure-authenticated-middleware';
import { GeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { HashProvider } from '@/app/infra/hashing/HashProvider';
import { TokenProvider } from '@/app/infra/token/TokenProvider';
import { UserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { userRepository } from '@/modules/users/users.composition';
import { TokenValidityProvider } from './infra/token-validity/TokenValidityProvider';

export const hashProvider = new HashProvider();
export const tokenProvider = new TokenProvider();
export const geolocationProvider = new GeolocationProvider();
export const userAgentProvider = new UserAgentProvider();
export const tokenValidityProvider = new TokenValidityProvider(userRepository);

export const authMiddleware = ensureAuthenticatedMiddleware(tokenProvider, tokenValidityProvider);

```

# File: src\app\exceptions\AppError.ts

```typescript
export class AppError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;

        // Boa prática: renomear o erro para facilitar a leitura no console
        this.name = 'AppError';
    }
}

```

# File: src\app\http\middlewares\ensure-authenticated-middleware.ts

```typescript
import { AppError } from '@/app/exceptions/AppError';
import { ITokenValidityProvider } from '@/app/infra/token-validity/TokenValidityProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { NextFunction, Request, Response } from 'express';

interface TokenPayload {
    sub: string;
    iat: number;
    exp: number;
}

export function ensureAuthenticatedMiddleware(tokenProvider: ITokenProvider, tokenValidityProvider: ITokenValidityProvider) {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new AppError('Token JWT não informado.', 401);
        }

        const [, token] = authHeader.split(' ');
        // 1. Tenta decodificar o token. Se falhar (expirado, assinatura inválida, etc),
        // o catch captura e retorna o erro correto.
        let decoded: TokenPayload;
        try {
            decoded = tokenProvider.verify(token) as TokenPayload;
        } catch {
            throw new AppError('Token JWT inválido ou expirado.', 401);
        }

        // 2. Agora fazemos a checagem de revogação FORA do try/catch.
        // Se disparar o AppError aqui, ele vai direto para o handler global de erros da API.
        const revokedAt = await tokenValidityProvider.getRevokedAt(decoded.sub);

        if (revokedAt && decoded.iat < Math.floor(revokedAt.getTime() / 1000)) {
            throw new AppError('Sessão revogada. Faça login novamente.', 401);
        }

        // 3. Tudo certo! Passou em todas as validações, podemos injetar o user na Request.
        req.user = { id: decoded.sub };

        return next();
    };
}

```

# File: src\app\http\middlewares\error-handler-middleware.ts

```typescript
import { AppError } from '@/app/exceptions/AppError';
import { logger } from '@/app/utils/logger';
import * as Sentry from '@sentry/node';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
    // 1. É um erro operacional previsto pelas nossas regras de negócio?
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ status: 'error', message: err.message });
    }

    // 2. SE FOR UM ERRO GERADO PELO ZOD (Validação de Schema)
    if (err instanceof ZodError) {
        return res.status(400).json({
            status: 'error',
            message: 'Erro de validação nos campos enviados.',
            // Mapeamos os erros para o front-end saber exatamente qual campo falhou
            errors: err.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
            })), // <-- Note os parênteses envolvendo as chaves do objeto!
        });
    }

    // 3. Erros não tratados (Bugs inesperados de código, falha no banco, etc.)

    // Dispara o alarme no Sentry (Avisa você no celular/email)
    Sentry.captureException(err, {
        extra: {
            body: req.body, // Ajuda a simular o que o usuário enviou
            params: req.params,
            query: req.query,
        },
        // Se a requisição passou pelo middleware de autenticação, vinculamos o erro ao usuário!
        user: req.user ? { id: req.user.id } : undefined,
        tags: {
            route: req.originalUrl,
            method: req.method,
        },
    });

    // Salva no log local do servidor com o Pino (Guarda o Stack Trace completo)
    logger.error(
        {
            err,
            method: req.method,
            path: req.originalUrl,
            body: req.body,
            userId: req.user?.id,
        },
        'Unhandled Server Error',
    );

    console.error('🚨 [Unhandled Error]:', err); // Debug no terminal
    return res.status(500).json({
        status: 'error',
        message: 'Ocorreu um erro interno no servidor. Nossa equipe já foi notificada.',
    });
}

```

# File: src\app\http\middlewares\rate-limiter.middleware.ts

```typescript
import { AppError } from '@/app/exceptions/AppError';
import { redisClient } from '@/app/infra/redis/redis-client';
import { rateLimit } from 'express-rate-limit';
import { RedisStore, SendCommandFn } from 'rate-limit-redis';
import { withFailOpen } from './with-fail-open';

const rateLimitHandlerIP = () => {
    throw new AppError('Muitas tentativas excedidas a partir deste IP. Tente novamente mais tarde.', 429);
};

const rateLimitHandlerAccount = () => {
    throw new AppError('Muitas tentativas excedidas a partir desta conta. Tente novamente mais tarde.', 429);
};

const getAccountKey = (email: string) => email.trim().toLowerCase();

/**
 * Envolve um rate limiter para que, se o STORE (Redis) falhar por motivo de
 * infraestrutura, a requisição passe direto (fail-open) em vez de travar
 * o endpoint inteiro. Um 429 legítimo (limite realmente excedido) continua
 * sendo bloqueado normalmente, porque é um AppError intencional.
 */

// --- RATE LIMITERS REDIS ---
const ipLimiterRedis = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (async (...args: string[]) => {
            const [command, ...rest] = args;
            try {
                return await redisClient.call(command!, ...rest);
            } catch (error: unknown) {
                if (command?.toUpperCase() === 'SCRIPT') {
                    return 'dummy-sha-to-bypass-init-error';
                }
                throw error;
            }
        }) as SendCommandFn,
        prefix: 'rl:auth:ip:',
    }),
    handler: rateLimitHandlerIP,
});

export const accountLimiterRedis = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const email = typeof req.body?.email === 'string' ? req.body.email : 'unknown';
        return getAccountKey(email);
    },
    store: new RedisStore({
        sendCommand: (async (...args: string[]) => {
            const [command, ...rest] = args;
            try {
                return await redisClient.call(command!, ...rest);
            } catch (error: unknown) {
                if (command?.toUpperCase() === 'SCRIPT') {
                    return 'dummy-sha-to-bypass-init-error';
                }
                throw error;
            }
        }) as SendCommandFn,
        prefix: 'rl:auth:account:',
    }),
    handler: rateLimitHandlerAccount,
});

// --- RATE LIMITERS FALLBACK (MEMÓRIA) ---
const ipLimiterMemoryFallback = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandlerIP,
});

const accountLimiterMemoryFallback = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Corrigido de 10 para 5 para manter consistência com o Redis
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Corrigido: Agora o Fallback também limita por e-mail!
        const email = typeof req.body?.email === 'string' ? req.body.email : 'unknown';
        return getAccountKey(email);
    },
    handler: rateLimitHandlerAccount,
});

export const authIpRateLimiter = withFailOpen(ipLimiterRedis, ipLimiterMemoryFallback, 'ip');
export const authAccountRateLimiter = withFailOpen(accountLimiterRedis, accountLimiterMemoryFallback, 'account');

/**
 * Limpa o contador de tentativas de login (tanto de IP quanto de Conta)
 * Deve ser chamada após um login efetuado com SUCESSO.
 */
export async function resetAuthRateLimits(ip: string, email: string): Promise<void> {
    const formattedEmail = getAccountKey(email);

    try {
        // Tenta resetar nos stores do Redis
        accountLimiterRedis.resetKey(formattedEmail);
        ipLimiterRedis.resetKey(ip);
    } catch (error) {
        console.error('⚠️ [RateLimiter] Erro ao resetar chaves no Redis (silenciado):', error);
    }

    try {
        // Reseta também nos stores de memória por garantia
        accountLimiterMemoryFallback.resetKey(formattedEmail);
        ipLimiterMemoryFallback.resetKey(ip);
    } catch (error) {
        console.error('⚠️ [RateLimiter] Erro ao resetar chaves no Fallback (silenciado):', error);
    }
}

```

# File: src\app\http\middlewares\validate-data-middleware.ts

```typescript
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export const validateDataMiddleware = <T extends z.ZodTypeAny>(schema: T) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            req.body = await schema.parseAsync(req.body);
            // Se passou com sucesso, o fluxo continua para o Controller
            return next();
        } catch (error) {
            // Se o Zod falhar, o erro (ZodError) é passado para o next(error).
            // O Express vai capturá-lo e enviá-lo direto para o nosso errorHandler global!
            return next(error);
        }
    };
};

```

# File: src\app\http\middlewares\with-fail-open.ts

```typescript
// src/app/http/middlewares/with-fail-open.ts
import { AppError } from '@/app/exceptions/AppError';
import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Envolve um rate limiter para que, se o STORE (Redis) falhar por motivo de
 * infraestrutura, a requisição passe direto (fail-open) em vez de travar
 * o endpoint inteiro. Um 429 legítimo (limite realmente excedido) continua
 * sendo bloqueado normalmente, porque é um AppError intencional.
 */
export function withFailOpen(primary: RequestHandler, fallback: RequestHandler, limiterName: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        primary(req, res, (err?: unknown) => {
            if (!err) {
                return next();
            }

            if (err instanceof AppError) {
                // Limite realmente excedido - erro intencional, repassa
                return next(err);
            }

            // Qualquer outro erro (ex: Redis fora do ar) = falha de infraestrutura
            console.error(`🔴 [RateLimiter:${limiterName}] Store indisponível, aplicando fail-open:`, (err as Error).message);
            return fallback(req, res, next);
        });
    };
}

```

# File: src\app\infra\geolocation\GeolocationProvider.ts

```typescript
import geoip from 'geoip-lite';

export interface LocationInfo {
    city: string | null;
    region: string | null;
    country: string | null;
}

export interface IGeolocationProvider {
    lookup(ip: string): LocationInfo;
}

export class GeolocationProvider implements IGeolocationProvider {
    lookup(ip: string): LocationInfo {
        const result = geoip.lookup(ip);

        if (!result) {
            return { city: null, region: null, country: null }; // IP local (ex: ::1 em dev) não resolve
        }

        return {
            city: result.city || null,
            region: result.region || null,
            country: result.country || null,
        };
    }
}

```

# File: src\app\infra\hashing\HashProvider.ts

```typescript
import argon2 from 'argon2';

export interface IHashProvider {
    hash(plainText: string): Promise<string>;
    compare(plainText: string, hashedValue: string): Promise<boolean>;
}

export class HashProvider implements IHashProvider {
    hash(plainText: string): Promise<string> {
        return argon2.hash(plainText);
    }

    compare(plainText: string, hashedValue: string): Promise<boolean> {
        return argon2.verify(hashedValue, plainText);
    }
}

```

# File: src\app\infra\redis\redis-client.ts

```typescript
import { env } from '@/env';
import Redis from 'ioredis';

export const redisClient = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
});

redisClient.on('error', (err) => {
    console.error('🚨 [ioredis Error]:', err); // Debug no terminal
});

```

# File: src\app\infra\token\TokenProvider.ts

```typescript
import { env } from '@/env';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface ITokenProvider {
    generate(userId: string): string;
    verify(token: string): { sub: string };
}

export class TokenProvider implements ITokenProvider {
    generate(userId: string): string {
        return jwt.sign({ sub: userId }, env.JWT_SECRET, {
            expiresIn: env.ACCESS_TOKEN_EXPIRES_AT as SignOptions['expiresIn'],
            algorithm: 'HS256',
        });
    }

    verify(token: string): { sub: string } {
        const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
        return decoded as { sub: string };
    }
}

```

# File: src\app\infra\token-validity\fakes\fake-token-validity-provider.ts

```typescript
import { ITokenValidityProvider } from '@/app/infra/token-validity/TokenValidityProvider';
import { IUserRepository } from '@/modules/users/users.repository';

export class InMemoryTokenValidityProvider implements ITokenValidityProvider {
    constructor(private readonly userRepository: IUserRepository) {}

    async getRevokedAt(userId: string): Promise<Date | null> {
        // Nos testes unitários, pulamos o Redis e lemos direto do repositório fake em memória
        return await this.userRepository.getTokensRevokedAt(userId);
    }

    async revokeAllTokens(userId: string): Promise<void> {
        const now = new Date();
        // Atualiza a data de revogação no repositório fake em memória
        await this.userRepository.setTokensRevokedAt(userId, now);
    }
}

```

# File: src\app\infra\token-validity\TokenValidityProvider.ts

```typescript
// src/app/infra/token-validity/token-validity.provider.ts
import { redisClient } from '@/app/infra/redis/redis-client';
import { IUserRepository } from '@/modules/users/users.repository';

export interface ITokenValidityProvider {
    getRevokedAt(userId: string): Promise<Date | null>;
    revokeAllTokens(userId: string): Promise<void>;
}

export class TokenValidityProvider implements ITokenValidityProvider {
    constructor(private readonly userRepository: IUserRepository) {}

    async getRevokedAt(userId: string): Promise<Date | null> {
        const cacheKey = `tokens-revoked-at:${userId}`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached !== null) {
                return cached === 'null' ? null : new Date(Number(cached));
            }
        } catch {
            // Redis fora do ar: segue direto pro banco, não bloqueia nem ignora a checagem
        }

        const value = await this.userRepository.getTokensRevokedAt(userId);
        try {
            await redisClient.set(cacheKey, value ? value.getTime().toString() : 'null', 'EX', 300); // cache 5min
        } catch {
            // cache indisponível não deveria travar o fluxo
        }

        return value;
    }

    async revokeAllTokens(userId: string): Promise<void> {
        const now = new Date();
        await this.userRepository.setTokensRevokedAt(userId, now);

        try {
            await redisClient.del(`tokens-revoked-at:${userId}`); // invalida cache pra refletir imediatamente
        } catch {
            // se o del falhar, o pior caso é o cache antigo durar até 5min a mais - aceitável
        }
    }
}

```

# File: src\app\infra\user-agent\UserAgentProvider.ts

```typescript
import { UAParser } from 'ua-parser-js';

export interface DeviceInfo {
    browser: string | null;
    os: string | null;
    deviceType: string | null;
}

export interface IUserAgentProvider {
    parse(userAgentString: string): DeviceInfo;
}

export class UserAgentProvider implements IUserAgentProvider {
    parse(userAgentString: string): DeviceInfo {
        const result = UAParser(userAgentString);
        return {
            browser: result.browser.name ?? null,
            os: result.os.name ?? null,
            deviceType: result.device.type ?? 'desktop', // sem tipo definido geralmente é desktop
        };
    }
}

```

# File: src\app\utils\hash-token.spec.ts

```typescript
import { describe, expect, it } from 'vitest';
import { hashToken } from './hash-token';

describe('Hash Token Utility', () => {
    it('deve retornar um hash criptografado para uma string limpa', () => {
        const plainToken = 'meu-token-secreto-123';

        const hashed = hashToken(plainToken);

        expect(hashed).toBeDefined();
        expect(hashed).not.toBe(plainToken);
        expect(typeof hashed).toBe('string');
    });

    it('deve gerar o mesmo hash para a mesma entrada (determinístico)', () => {
        const plainToken = 'token-de-teste';

        const hash1 = hashToken(plainToken);
        const hash2 = hashToken(plainToken);

        expect(hash1).toEqual(hash2);
    });

    it('deve gerar o diferentes hashs para a entradas diferentes', () => {
        const plainToken = 'token-de-teste';
        const plainToken2 = 'token-de-teste2';

        const hash1 = hashToken(plainToken);
        const hash2 = hashToken(plainToken2);

        expect(hash1).not.toEqual(hash2);
    });
});

```

# File: src\app\utils\hash-token.ts

```typescript
import crypto from 'node:crypto';

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

```

# File: src\app\utils\logger.ts

```typescript
import { env } from '@/env';
import pino from 'pino';

export const logger = pino({
    level: env.LOG_LEVEL,
    // Em desenvolvimento, usa o pino-pretty para ficar legível.
    // Em produção (NODE_ENV=production), cospe JSON puro (mais rápido e ideal para AWS/Datadog).
    transport: {
        // 'targets' permite enviar o log para vários lugares ao mesmo tempo
        targets: [
            // 1. Manda pro Console (com pino-pretty pra ficar legível)
            {
                target: 'pino-pretty',
                options: { colorize: true },
                level: 'info',
            },
            // 2. Salva em Arquivo com Rotação (Log Rotation)
            {
                target: 'pino-roll',
                options: {
                    // O nome base do arquivo (sem data e sem extensão)
                    file: './logs/error',

                    // O formato da data que será injetado (padrão yyyy-MM-dd)
                    dateFormat: 'yyyy-MM-dd',

                    // A extensão que vai no final de tudo
                    extension: '.log',

                    frequency: 'daily',
                    size: '10m',
                    mkdir: true,
                },
                level: 'error',
            },
        ],
    },
});

```

# File: src\app\utils\set-refresh-token-cookie.ts

```typescript
import { env } from '@/env';
import { Response } from 'express';

export function setRefreshTokenCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production', // exige HTTPS em produção
        sameSite: 'strict',
        path: '/api/auth', // só é enviado pras rotas de auth (refresh/logout), não em toda API
        expires: expiresAt,
    });
}

```

# File: src\database\index.ts

```typescript
import { env } from '@/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Cria o pool de conexões com o banco
const pool = new Pool({
    connectionString: env.DATABASE_URL,
});

export const databaseInstance = drizzle(pool, { schema });

export type DatabaseType = typeof databaseInstance;

```

# File: src\database\schema.ts

```typescript
import { boolean, index, inet, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// Tabela de Usuários
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Dados Pessoais
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),

    // Credenciais
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),

    // Segurança Adicional Planejada (LGPD / Auth)
    isEmailConfirmed: boolean('is_email_confirmed').default(false).notNull(),
    totpSecret: varchar('totp_secret', { length: 255 }), // Nulo se 2FA desativado
    isTwoFactorEnabled: boolean('is_two_factor_enabled').default(false).notNull(),
    tokensRevokedAt: timestamp('tokens_revoked_at'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tabela de Tokens de Atualização (Sessões)
export const refreshTokens = pgTable(
    'refresh_tokens',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        hashedToken: varchar('hashed_token', { length: 255 }).notNull().unique(),

        // Relacionamento com a tabela users
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // Cascade garante estabilidade dos dados

        // Controle de Rotação e Validade
        expiresAt: timestamp('expires_at').notNull(),
        revokedAt: timestamp('revoked_at'),

        // Identificação
        ipAddress: inet('ip_address').notNull(),
        city: text('city'),
        region: text('region'),
        country: text('country'),
        browser: text('browser'),
        os: text('os'),
        deviceType: text('device_type'),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [index('refresh_tokens_user_id_idx').on(table.userId)], // 👇 Criamos um índice B-Tree na coluna user_id para otimizar buscas e revogações por usuário
);

export const loginAttemptsStatus = pgEnum('login_attempt_status', ['success', 'fail']);
export const loginAttempts = pgTable(
    'login_attempts',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        status: loginAttemptsStatus('status').notNull(),
        ipAddress: inet('ip_address').notNull(),

        // Identificação
        email: varchar('email', { length: 255 }),
        userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
        city: text('city'),
        region: text('region'),
        country: text('country'),
        browser: text('browser'),
        os: text('os'),
        deviceType: text('device_type'),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [index('login_attempts_user_id_idx').on(table.userId)],
);

```

# File: src\database\types.ts

```typescript

```

# File: src\env\index.ts

```typescript
import 'dotenv/config'; // Garante que o .env foi lido antes da validação
import { z } from 'zod';

const envSchema = z.object({
    // Configurações do Servidor
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    SERVER_PORT: z.coerce.number().default(3333),
    TRUST_PROXY_HOPS: z.coerce.number().default(0),
    FRONTEND_URL: z.string().url('A URL do frontend deve ser uma URL válida'),
    LOG_LEVEL: z.string().default('info'),
    SENTRY_DSN: z.string().url().optional(),

    // Banco de Dados
    DATABASE_URL: z.string().url('A URL do banco de dados deve ser uma URL válida'),

    // Autenticação e Segurança
    JWT_SECRET: z.string().min(16, 'O JWT_SECRET deve ter no mínimo 16 caracteres para ser seguro'),
    ACCESS_TOKEN_EXPIRES_AT: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_AT: z.coerce.number().default(7),

    // Redis
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('❌ Erro Crítico: Variáveis de ambiente inválidas ou ausentes.');
    console.error(_env.error.format());
    process.exit(1); // Derruba a aplicação instantaneamente
}

export const env = _env.data;

```

# File: src\modules\authentication\authentication.composition.ts

```typescript
import { geolocationProvider, hashProvider, tokenProvider, tokenValidityProvider, userAgentProvider } from '@/app/composition-root';
import { databaseInstance } from '@/database/index';
import { userRepository } from '@/modules/users/users.composition';

import { AuthenticateController } from './authentication.controller';
import { AuthenticateUserService } from './authentication.services';
import { LoginAttemptsRepository } from './login-attempts.repository';
import { DrizzleRefreshTokenRepository } from './refresh-tokens.repository';

const refreshTokenRepository = new DrizzleRefreshTokenRepository(databaseInstance);
const loginAttemptRepository = new LoginAttemptsRepository(databaseInstance);

const authenticateService = new AuthenticateUserService(
    userRepository,
    refreshTokenRepository,
    loginAttemptRepository,
    hashProvider,
    tokenProvider,
    geolocationProvider,
    userAgentProvider,
    tokenValidityProvider,
);

export const authenticateController = new AuthenticateController(authenticateService);

```

# File: src\modules\authentication\authentication.controller.ts

```typescript
import { AppError } from '@/app/exceptions/AppError';
import { resetAuthRateLimits } from '@/app/http/middlewares/rate-limiter.middleware';
import { setRefreshTokenCookie } from '@/app/utils/set-refresh-token-cookie';
import { Request, Response } from 'express';
import { AuthenticateUserService } from './authentication.services';

export class AuthenticateController {
    constructor(private readonly authenticateService: AuthenticateUserService) {}

    registerUser = async (req: Request, res: Response): Promise<Response> => {
        const data = req.body;

        const user = await this.authenticateService.registerUser(data);

        return res.status(201).json(user);
    };

    loginUser = async (req: Request, res: Response): Promise<Response> => {
        const { email, password } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
        const userAgentString = req.headers['user-agent'] ?? 'unknown';

        const { user, token, refreshToken, refreshTokenExpiresAt } = await this.authenticateService.loginUser({ email, password }, ipAddress, userAgentString);
        setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);
        await resetAuthRateLimits(ipAddress, email);

        return res.status(200).json({ user, token });
    };

    refreshToken = async (req: Request, res: Response): Promise<Response> => {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
        const userAgentString = req.headers['user-agent'] ?? 'unknown';

        const { token, refreshToken: newRefreshToken, refreshTokenExpiresAt } = await this.authenticateService.refresh(refreshToken, ipAddress, userAgentString);
        setRefreshTokenCookie(res, newRefreshToken, refreshTokenExpiresAt);

        return res.status(200).json({ token });
    };

    logout = async (req: Request, res: Response): Promise<Response> => {
        const refreshToken = req.cookies?.refreshToken;

        try {
            await this.authenticateService.revokeByRawToken(refreshToken);
        } catch (_error) {
            /* empty */
        }

        res.clearCookie('refreshToken', { path: '/api/auth' });
        return res.status(204).send();
    };

    revokeAllUserTokens = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;

        // Recebe a decisão do Front-end (padrão: desconectar tudo)
        const keepCurrentSession = req.body?.keepCurrentSession || false;

        // Recupera o Refresh Token atual do cookie
        const refreshTokenString = req.cookies?.refreshToken;

        // Executa o caso de uso
        const { accessToken } = await this.authenticateService.revokeSessionsService(userId, keepCurrentSession, refreshTokenString);

        // Se 'accessToken' é nulo, significa que foi um LOGOUT GLOBAL.
        if (!accessToken) {
            res.clearCookie('refreshToken', { path: '/api/auth' });
            return res.json({ message: 'Você foi desconectado de todos os dispositivos.' });
        }

        // Se há um token novo, a sessão atual foi preservada.
        return res.json({
            message: 'Todos os outros dispositivos foram desconectados. Sua sessão atual foi mantida.',
            accessToken,
        });
    };
}

```

# File: src\modules\authentication\authentication.routes.ts

```typescript
import { Router } from 'express';

import { authMiddleware } from '@/app/composition-root';
import { authAccountRateLimiter, authIpRateLimiter } from '@/app/http/middlewares/rate-limiter.middleware';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { authenticateController } from './authentication.composition';
import { authenticateUserSchema, registerUserSchema } from './authentication.schemas';

export const authRoutes = Router();

authRoutes.post('/register', validateDataMiddleware(registerUserSchema), authenticateController.registerUser);
authRoutes.post('/login', authIpRateLimiter, authAccountRateLimiter, validateDataMiddleware(authenticateUserSchema), authenticateController.loginUser);
authRoutes.post('/refresh', authIpRateLimiter, authenticateController.refreshToken);
authRoutes.post('/logout', authenticateController.logout);
authRoutes.post('/logout-all-devices', authMiddleware, authenticateController.revokeAllUserTokens);

```

# File: src\modules\authentication\authentication.schemas.ts

```typescript
import z from 'zod';

export const authenticateUserSchema = z.object({
    email: z.string().trim().toLowerCase().email('Formato de e-mail inválido'),
    password: z.string().min(1, 'A senha é obrigatória'),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string({
        error: 'O refresh token é obrigatório.',
    }),
});

export const registerUserSchema = z
    .object({
        firstName: z
            .string()
            .trim()
            .min(2, 'O nome deve ter no mínimo 2 caracteres')
            .transform((val) => val.charAt(0).toUpperCase() + val.slice(1)),
        lastName: z
            .string()
            .trim()
            .min(2, 'O sobrenome deve ter no mínimo 2 caracteres')
            .transform((val) => val.charAt(0).toUpperCase() + val.slice(1)),

        email: z.string().trim().toLowerCase().email('Formato de e-mail inválido'),

        password: z
            .string()
            .min(8, 'A senha deve ter no mínimo 8 caracteres')
            .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
            .regex(/[!@#$%^&*(),.?":{}|<>]/, 'A senha deve conter pelo menos um caractere especial'),

        passwordConfirmation: z.string({
            error: 'O campo de confirmação de senha é obrigatório, mas não foi encontrado',
        }),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
        message: 'As senhas não coincidem',
        path: ['passwordConfirmation'],
    });

// Gerando o tipo TypeScript a partir do Schema
export type AuthenticateUserDTO = z.infer<typeof authenticateUserSchema>;
export type RegisterUserDTO = z.infer<typeof registerUserSchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;

```

# File: src\modules\authentication\authentication.services.ts

```typescript
import { AppError } from '@/app/exceptions/AppError';
import { IGeolocationProvider } from '@/app/infra/geolocation/GeolocationProvider';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenValidityProvider } from '@/app/infra/token-validity/TokenValidityProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { IUserAgentProvider } from '@/app/infra/user-agent/UserAgentProvider';
import { hashToken } from '@/app/utils/hash-token';
import { env } from '@/env';
import { IUserRepository } from '@/modules/users/users.repository';
import crypto from 'node:crypto';
import { SafeUser } from '../users/users.types';
import { AuthenticateUserDTO, RegisterUserDTO } from './authentication.schemas';
import { ILoginAttemptsRepository } from './login-attempts.repository';
import { IRefreshTokenRepository } from './refresh-tokens.repository';

export class AuthenticateUserService {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly refreshTokenRepository: IRefreshTokenRepository,
        private readonly loginAttemptRepository: ILoginAttemptsRepository,
        private readonly hashProvider: IHashProvider,
        private readonly tokenProvider: ITokenProvider,
        private readonly geolocationProvider: IGeolocationProvider,
        private readonly userAgentProvider: IUserAgentProvider,
        private readonly tokenValidityProvider: ITokenValidityProvider,
    ) {}

    async loginUser(data: AuthenticateUserDTO, ipAddress: string, userAgentString: string) {
        const { email, password } = data;

        const user = await this.userRepository.findByEmail(email, true);
        const location = this.geolocationProvider.lookup(ipAddress);
        const device = this.userAgentProvider.parse(userAgentString);

        // hash "dummy", nunca corresponde a senha nenhuma - só existe pra gastar o mesmo tempo de CPU
        const DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$ov2rVR+AcpuDLmUn6skwHg$trsz7jJNUnKjVWSAz862t7wFWgcT1Z19LgXgITvZH7c';
        const passwordMatch = await this.hashProvider.compare(password, user ? user.passwordHash : DUMMY_HASH);

        if (!user || !passwordMatch) {
            await this.loginAttemptRepository.generateAttempt('fail', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user?.id);
            throw new AppError('E-mail ou senha inválidos.', 401);
        }

        // Gera novo token de acesso
        const token = this.tokenProvider.generate(user.id);

        // Gera um novo refresh token
        const rawRefreshToken = crypto.randomBytes(64).toString('hex');
        const hashedRefreshToken = hashToken(rawRefreshToken);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_AT);

        await this.refreshTokenRepository.create(user.id, hashedRefreshToken, expiresAt, ipAddress, location.city, location.region, location.country, device.os, device.deviceType);

        const { passwordHash: _, ...userWithoutPassword } = user;

        await this.loginAttemptRepository.generateAttempt('success', ipAddress, location.city, location.region, location.country, device.os, device.deviceType, email, user.id);

        return {
            user: userWithoutPassword,
            token,
            refreshToken: rawRefreshToken,
            refreshTokenExpiresAt: expiresAt,
        };
    }

    async refresh(rawToken: string, ipAddress: string, userAgentString: string) {
        if (!rawToken) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const hashedToken = hashToken(rawToken);
        const tokenRecord = await this.refreshTokenRepository.findByTokenHash(hashedToken);

        if (!tokenRecord) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const nowDate = new Date();

        // Valida se expirou por data de validade absoluta
        if (nowDate > new Date(tokenRecord.expiresAt)) {
            throw new AppError('Refresh token expirado.', 401);
        }

        // Valida se já foi revogado (Tratamento com Grace Period para concorrência)
        if (tokenRecord.revokedAt) {
            const diffInSeconds = (nowDate.getTime() - new Date(tokenRecord.revokedAt).getTime()) / 1000;
            const GRACE_PERIOD_SECONDS = 20;

            // Se passou da janela de graça, é tentativa de roubo/reuso malicioso!
            if (diffInSeconds > GRACE_PERIOD_SECONDS) {
                await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
                await this.tokenValidityProvider.revokeAllTokens(tokenRecord.userId);
                throw new AppError('Sessão comprometida. Faça login novamente.', 401);
            }
        }

        // ROTAÇÃO DE TOKEN COM TRANSAÇÃO ATÔMICA
        const { accessToken, newRawRefreshToken, expiresAt } = await this.refreshTokenRepository.transaction(async (tx) => {
            if (!tokenRecord.revokedAt) {
                await this.refreshTokenRepository.revokeToken(tokenRecord.id, tx);
            }

            const newAccessToken = this.tokenProvider.generate(tokenRecord.userId);
            const rawRefresh = crypto.randomBytes(64).toString('hex');
            const hashedRefresh = hashToken(rawRefresh);
            const exp = new Date();
            exp.setDate(exp.getDate() + env.REFRESH_TOKEN_EXPIRES_AT);

            const locationInfo = this.geolocationProvider.lookup(ipAddress);
            const deviceInfo = this.userAgentProvider.parse(userAgentString);

            await this.refreshTokenRepository.create(
                tokenRecord.userId,
                hashedRefresh,
                exp,
                ipAddress,
                locationInfo.city,
                locationInfo.region,
                locationInfo.country,
                deviceInfo.os,
                deviceInfo.deviceType,
                tx,
            );

            return {
                accessToken: newAccessToken,
                newRawRefreshToken: rawRefresh,
                expiresAt: exp,
            };
        });

        return { accessToken, newRawRefreshToken, expiresAt };
    }

    async revokeByRawToken(token: string): Promise<void> {
        const hashedToken = hashToken(token);
        const tokenRecord = await this.refreshTokenRepository.findByTokenHash(hashedToken);
        if (!tokenRecord) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const nowDate = new Date();

        // Valida se já foi revogado
        if (tokenRecord.revokedAt) {
            const diffInSeconds = (nowDate.getTime() - new Date(tokenRecord.revokedAt).getTime()) / 1000;
            const GRACE_PERIOD_SECONDS = 20;

            if (diffInSeconds > GRACE_PERIOD_SECONDS) {
                await this.refreshTokenRepository.revokeAllTokensByUser(tokenRecord.userId);
                await this.tokenValidityProvider.revokeAllTokens(tokenRecord.userId);
                throw new AppError('Refresh token inválido ou já utilizado.', 401);
            }
        }

        await this.refreshTokenRepository.revokeToken(tokenRecord.id);
    }

    async revokeSessionsService(userId: string, keepCurrentSession: boolean, currentRefreshToken?: string) {
        // 1. Invalida todos os Access Tokens emitidos no passado (incluindo o da sessão atual)
        await this.tokenValidityProvider.revokeAllTokens(userId);

        if (keepCurrentSession && currentRefreshToken) {
            // 2A. Mantém apenas o Refresh Token atual vivo no banco
            const hashedToken = hashToken(currentRefreshToken);
            await this.refreshTokenRepository.revokeAllTokensByUser(userId, hashedToken);

            // 3. Como matamos todos os Access Tokens no passo 1, geramos um NOVO
            // com um timestamp superior à revogação, para a sessão atual não cair.
            const newAccessToken = this.tokenProvider.generate(userId);
            return { accessToken: newAccessToken };
        }

        // 2B. Destrói TODOS os Refresh Tokens do banco (Logout global absoluto)
        await this.refreshTokenRepository.revokeAllTokensByUser(userId);

        return { accessToken: null };
    }

    async registerUser(data: RegisterUserDTO): Promise<SafeUser> {
        const userAlreadyExists = await this.userRepository.findByEmail(data.email);
        if (userAlreadyExists) {
            throw new AppError('Esse e-mail já está vinculado a uma conta cadastrada no sistema.', 409);
        }

        // Extraímos o 'password' e agrupamos o resto das propriedades na variável 'userData'
        const { password: _, ...userData } = data;

        const hashedPassword = await this.hashProvider.hash(data.password);

        const createdUser = await this.userRepository.create({
            ...userData,
            passwordHash: hashedPassword,
        });
        return createdUser;
    }
}

```

# File: src\modules\authentication\authentication.types.ts

```typescript
import { loginAttempts, refreshTokens } from '../../database/schema';
import type { SafeUser, User } from '../users/users.types';

// ==========================================
// REFRESH TOKENS
// ==========================================

// Tipos Base
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type CreateRefreshToken = typeof refreshTokens.$inferInsert;

// Composições
export type RefreshTokenWithUser = RefreshToken & {
    user: User; // Um token sempre pertence a um usuário (notNull no schema)
};

export type RefreshTokenWithSafeUser = RefreshToken & {
    user: SafeUser; // Ideal para rotas que listam as sessões ativas do usuário
};

// ==========================================
// LOGIN ATTEMPTS
// ==========================================

// Tipos Base
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type CreateLoginAttempt = typeof loginAttempts.$inferInsert;

// Composições
export type LoginAttemptWithUser = LoginAttempt & {
    // O usuário pode ser nulo aqui, pois tentativas de login falhas
    // podem ocorrer com e-mails não cadastrados
    user: User | null;
};

```

# File: src\modules\authentication\fakes\fake-login-attempts.repository.ts

```typescript
import * as crypto from 'node:crypto';
import { LoginAttempt } from '../authentication.types';

export interface IFakeLoginAttemptsRepository {
    generateAttempt(
        status: 'success' | 'fail',
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        email?: string,
        userId?: string,
    ): Promise<LoginAttempt | null>;
}

export class InMemoryLoginAttemptsRepository implements IFakeLoginAttemptsRepository {
    // Array interno para armazenar as tentativas de login em memória
    public items: LoginAttempt[] = [];

    async generateAttempt(
        status: 'success' | 'fail',
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        email?: string,
        userId?: string,
    ): Promise<LoginAttempt | null> {
        const newAttempt: LoginAttempt = {
            id: crypto.randomUUID(),
            status,
            ipAddress,
            city,
            region,
            country,
            os,
            deviceType,
            browser: 'Mozilla',
            email: email ?? null,
            userId: userId ?? null,
            createdAt: new Date(),
        };

        this.items.push(newAttempt);

        return newAttempt;
    }
}

```

# File: src\modules\authentication\fakes\fake-refresh-tokens.repository.ts

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crypto from 'node:crypto';
import { RefreshToken } from '../authentication.types';
import { TransactionClient } from '../refresh-tokens.repository';

export interface IFakeRefreshTokenRepository {
    create(
        userId: string,
        hashedToken: string,
        expiresAt: Date,
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        db?: TransactionClient,
    ): Promise<string>;
    findByTokenHash(hashedToken: string): Promise<RefreshToken | null>;
    revokeToken(id: string, db?: TransactionClient): Promise<void>;
    revokeAllTokensByUser(userId: string, exceptTokenId?: string, db?: TransactionClient): Promise<void>;
    transaction<T>(fn: (db: any) => Promise<T>): Promise<T>;
}

export class InMemoryRefreshTokenRepository implements IFakeRefreshTokenRepository {
    public items: RefreshToken[] = [];

    async create(
        userId: string,
        hashedToken: string,
        expiresAt: Date,
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        _db?: TransactionClient,
    ): Promise<string> {
        const id = crypto.randomUUID();

        const newToken: RefreshToken = {
            id,
            userId,
            hashedToken,
            expiresAt,
            revokedAt: null,
            ipAddress,
            city,
            region,
            country,
            os,
            deviceType,
            browser: 'Mozilla',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.items.push(newToken);

        return id;
    }

    async findByTokenHash(hashedToken: string): Promise<RefreshToken | null> {
        const tokenRecord = this.items.find((item) => item.hashedToken === hashedToken);
        return tokenRecord || null;
    }

    async revokeToken(id: string, _db?: TransactionClient): Promise<void> {
        const tokenRecord = this.items.find((item) => item.id === id);
        if (tokenRecord) {
            tokenRecord.revokedAt = new Date();
            tokenRecord.updatedAt = new Date();
        }
    }

    async revokeAllTokensByUser(userId: string, exceptTokenId?: string, _db?: TransactionClient): Promise<void> {
        this.items.forEach((item) => {
            if (item.userId === userId) {
                const isExceptional = exceptTokenId && item.hashedToken === exceptTokenId;

                if (!isExceptional && !item.revokedAt) {
                    item.revokedAt = new Date();
                    item.updatedAt = new Date();
                }
            }
        });
    }

    // 👇 ADICIONADO: Executa a callback simulando uma transação em memória
    async transaction<T>(fn: (db: any) => Promise<T>): Promise<T> {
        return await fn(undefined);
    }
}

```

# File: src\modules\authentication\login-attempts.repository.ts

```typescript
import { DatabaseType } from '@/database';
import { loginAttempts } from '@/database/schema';
import { LoginAttempt } from './authentication.types';

export interface ILoginAttemptsRepository {
    generateAttempt(
        status: 'success' | 'fail',
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        email?: string,
        userId?: string,
    ): Promise<LoginAttempt | null>;
}

export class LoginAttemptsRepository implements ILoginAttemptsRepository {
    constructor(private readonly db: DatabaseType) {}

    async generateAttempt(
        status: 'success' | 'fail',
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        email?: string,
        userId?: string,
    ): Promise<LoginAttempt | null> {
        const [attempt] = await this.db
            .insert(loginAttempts)
            .values({ status, ipAddress, city, region, country, os, deviceType, email: email ?? null, userId: userId ?? null })
            .returning();

        return attempt || null;
    }
}

```

# File: src\modules\authentication\refresh-tokens.repository.ts

```typescript
import { DatabaseType } from '@/database';
import { refreshTokens } from '@/database/schema';
import { and, eq, isNotNull, not } from 'drizzle-orm';
import { RefreshToken } from './authentication.types';

export type TransactionClient = Parameters<Parameters<DatabaseType['transaction']>[0]>[0];

export interface IRefreshTokenRepository {
    create(
        userId: string,
        hashedToken: string,
        expiresAt: Date,
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        db?: TransactionClient,
    ): Promise<string>;
    findByTokenHash(hashedToken: string): Promise<RefreshToken | null>;
    revokeToken(id: string, db?: TransactionClient): Promise<void>;
    revokeAllTokensByUser(userId: string, exceptTokenId?: string, db?: TransactionClient): Promise<void>;
    transaction<T>(fn: (db: TransactionClient) => Promise<T>): Promise<T>;
}

export class DrizzleRefreshTokenRepository implements IRefreshTokenRepository {
    constructor(private readonly db: DatabaseType) {}

    async create(
        userId: string,
        hashedToken: string,
        expiresAt: Date,
        ipAddress: string,
        city: string | null,
        region: string | null,
        country: string | null,
        os: string | null,
        deviceType: string | null,
        db?: TransactionClient,
    ): Promise<string> {
        const executor = db || this.db;
        const [tokenRecord] = await executor
            .insert(refreshTokens)
            .values({
                userId,
                hashedToken,
                expiresAt,
                revokedAt: null,
                ipAddress,
                city,
                region,
                country,
                os,
                deviceType,
            })
            .returning();

        return tokenRecord.id;
    }

    async findByTokenHash(hashedToken: string): Promise<RefreshToken | null> {
        const [tokenRecord] = await this.db.select().from(refreshTokens).where(eq(refreshTokens.hashedToken, hashedToken));

        return tokenRecord || null;
    }

    async revokeToken(id: string, db?: TransactionClient): Promise<void> {
        const executor = db || this.db;
        await executor.update(refreshTokens).set({ revokedAt: new Date(), updatedAt: new Date() }).where(eq(refreshTokens.id, id));
    }

    async revokeAllTokensByUser(userId: string, exceptTokenId?: string, db?: TransactionClient): Promise<void> {
        const executor = db || this.db;
        const conditions = [eq(refreshTokens.userId, userId), isNotNull(refreshTokens.revokedAt)];

        if (exceptTokenId) {
            conditions.push(not(eq(refreshTokens.hashedToken, exceptTokenId)));
        }

        await executor
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(and(eq(refreshTokens.userId, userId), ...conditions));
    }

    // 👇 ADICIONE ESTE MÉTODO NA CLASSE CONCRETA
    async transaction<T>(fn: (db: TransactionClient) => Promise<T>): Promise<T> {
        return await this.db.transaction(fn);
    }
}

```

# File: src\modules\authentication\tests\authentication.services.spec.ts

```typescript
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

```

# File: src\modules\users\fakes\fake-users.repository.ts

```typescript
import { CreateUser, SafeUser, User } from '../users.types';

export interface IFakeUserRepository {
    // Como o tipo de retorno depende do parâmetro showUserPasswordHash precisamos fazer
    // uma sobrecarga de função para garantir o resultado retornado em cada cenário.
    findByEmail(email: string, showUserPasswordHash: true): Promise<User | null>;
    findByEmail(email: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    findByEmail(email: string, showUserPasswordHash?: boolean): Promise<SafeUser | User | null>;

    findById(id: string, showUserPasswordHash: true): Promise<User | null>;
    findById(id: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    findById(id: string, showUserPasswordHash?: boolean): Promise<SafeUser | User | null>;

    create(data: CreateUser): Promise<SafeUser>;

    getTokensRevokedAt(userId: string): Promise<Date | null>;
    setTokensRevokedAt(userId: string, now: Date): Promise<void>;
}

export type CreateFakeUserData = CreateUser & {
    id?: string;
};

export class InMemoryUserRepository implements IFakeUserRepository {
    public items: User[] = [];

    async findByEmail(email: string, showUserPasswordHash: true): Promise<User | null>;
    async findByEmail(email: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    async findByEmail(email: string, showUserPasswordHash: boolean = false): Promise<SafeUser | User | null> {
        const user = this.items.find((item) => item.email === email);
        if (!user) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...userWithoutPassword } = user;
            return userWithoutPassword as SafeUser;
        }

        return user;
    }

    async findById(id: string, showUserPasswordHash: true): Promise<User | null>;
    async findById(id: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    async findById(id: string, showUserPasswordHash: boolean = false): Promise<SafeUser | User | null> {
        const user = this.items.find((item) => item.id === id);
        if (!user) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...userWithoutPassword } = user;
            return userWithoutPassword as SafeUser;
        }

        return user;
    }

    async create(data: CreateFakeUserData): Promise<SafeUser> {
        const newUser: User = {
            id: data.id ?? crypto.randomUUID(),
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            isEmailConfirmed: false,
            totpSecret: null,
            isTwoFactorEnabled: false,
            tokensRevokedAt: null,
            passwordHash: data.passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.items.push(newUser);

        const { passwordHash: _, ...userWithoutPassword } = newUser;
        return userWithoutPassword;
    }

    async getTokensRevokedAt(userId: string): Promise<Date | null> {
        const user = this.items.find((item) => item.id === userId);
        if (!user) {
            return null;
        }

        return user.tokensRevokedAt ?? null;
    }

    async setTokensRevokedAt(userId: string, now: Date): Promise<void> {
        const userIndex = this.items.findIndex((item) => item.id === userId);
        if (userIndex >= 0) {
            this.items[userIndex].tokensRevokedAt = now;
            this.items[userIndex].updatedAt = new Date();
        }
    }
}

```

# File: src\modules\users\users.composition.ts

```typescript
import { databaseInstance } from '@/database';
import { ProfileController } from './users.controller';
import { DrizzleUserRepository } from './users.repository';
import { UserService } from './users.services';

export const userRepository = new DrizzleUserRepository(databaseInstance);

const userService = new UserService(userRepository);
export const profileController = new ProfileController(userService);

```

# File: src\modules\users\users.controller.ts

```typescript
import { Request, Response } from 'express';
import { UserService } from './users.services';

export class ProfileController {
    constructor(private readonly userService: UserService) {}

    showProfile = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;

        const user = await this.userService.getProfile(userId);

        return res.status(200).json(user);
    };
}

```

# File: src\modules\users\users.repository.ts

```typescript
import { DatabaseType } from '@/database';
import { users } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { CreateUser, SafeUser, User } from './users.types';

export interface IUserRepository {
    // Como o tipo de retorno depende do parâmetro showUserPasswordHash precisamos fazer
    // uma sobrecarga de função para garantir o resultado retornado em cada cenário.
    findByEmail(email: string, showUserPasswordHash: true): Promise<User | null>;
    findByEmail(email: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    findByEmail(email: string, showUserPasswordHash?: boolean): Promise<SafeUser | User | null>;

    findById(id: string, showUserPasswordHash: true): Promise<User | null>;
    findById(id: string, showUserPasswordHash?: false): Promise<SafeUser | null>;
    findById(id: string, showUserPasswordHash?: boolean): Promise<SafeUser | User | null>;

    create(data: CreateUser): Promise<SafeUser>;

    getTokensRevokedAt(userId: string): Promise<Date | null>;
    setTokensRevokedAt(userId: string, now: Date): Promise<void>;
}

export class DrizzleUserRepository implements IUserRepository {
    constructor(private readonly db: DatabaseType) {}

    async findByEmail(email: string, showUserPasswordHash: true): Promise<User | null>;
    async findByEmail(email: string, showUserPasswordHash?: boolean): Promise<SafeUser | null>;
    async findByEmail(email: string, showUserPasswordHash: boolean = false): Promise<SafeUser | User | null> {
        // Retorna um array, ex: [{ id: 1, email: '...' }] ou []
        // Usamos a variável dentro de colchetes pq faz com que o javascript já retorne o primeiro item do array retornado tornando a variável o objeto em si.
        const [result] = await this.db.select().from(users).where(eq(users.email, email));
        if (!result) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...userWithoutPassword } = result;
            return (userWithoutPassword as SafeUser) || null;
        }

        return (result as User) || null;
    }

    async findById(id: string, showUserPasswordHash: true): Promise<User | null>;
    async findById(id: string, showUserPasswordHash?: boolean): Promise<SafeUser | null>;
    async findById(id: string, showUserPasswordHash: boolean = false): Promise<SafeUser | User | null> {
        const [result] = await this.db.select().from(users).where(eq(users.id, id));
        if (!result) {
            return null;
        }

        if (!showUserPasswordHash) {
            const { passwordHash: _, ...userWithoutPassword } = result;
            return (userWithoutPassword as SafeUser) || null;
        }

        return (result as User) || null;
    }

    async create(data: CreateUser): Promise<SafeUser> {
        const [result] = await this.db.insert(users).values(data).returning();

        const { passwordHash: _, ...userWithoutPassword } = result;

        return userWithoutPassword;
    }

    async getTokensRevokedAt(userId: string): Promise<Date | null> {
        const [user] = await this.db.select({ tokensRevokedAt: users.tokensRevokedAt }).from(users).where(eq(users.id, userId));

        // Retorna a data se existir, ou null
        return user?.tokensRevokedAt || null;
    }

    async setTokensRevokedAt(userId: string, date: Date): Promise<void> {
        await this.db.update(users).set({ tokensRevokedAt: date }).where(eq(users.id, userId));
    }
}

```

# File: src\modules\users\users.routes.ts

```typescript
import { authMiddleware } from '@/app/composition-root';
import { Router } from 'express';
import { profileController } from './users.composition';

export const userRoutes = Router();

userRoutes.get('/', authMiddleware, profileController.showProfile);
userRoutes.get('/test-crash', (_req, _res) => {
    // Simulando um erro clássico de Javascript (Cannot read properties of undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = undefined;
    console.log(obj.propriedadeInexistente);
});

```

# File: src\modules\users\users.services.ts

```typescript
import { AppError } from '@/app/exceptions/AppError';
import { SafeUser } from '@/modules/users/users.types';
import { IUserRepository } from './users.repository';

export class UserService {
    constructor(private readonly userRepository: IUserRepository) {}

    async getProfile(userId: string): Promise<SafeUser> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('Usuário não encontrado', 404);
        }
        return user;
    }
}

```

# File: src\modules\users\users.types.ts

```typescript
import { users } from '../../database/schema';
// Usamos 'import type' pelo mesmo motivo arquitetural
import type { LoginAttempt, RefreshToken } from '../authentication/authentication.types';

// ==========================================
// USERS
// ==========================================

// Tipos Base
export type User = typeof users.$inferSelect;
export type CreateUser = typeof users.$inferInsert;

// Tipo Seguro (Data Transfer Object para a web)
export type SafeUser = Omit<User, 'passwordHash' | 'totpSecret'>;

// ==========================================
// COMPOSIÇÕES
// ==========================================

// Usuário com suas sessões ativas
export type UserWithTokens = User & {
    refreshTokens: RefreshToken[];
};

// Versão segura do usuário com suas sessões
export type SafeUserWithTokens = SafeUser & {
    refreshTokens: RefreshToken[];
};

// Usuário com histórico de segurança (Log de acessos)
export type UserWithLoginAttempts = User & {
    loginAttempts: LoginAttempt[];
};

```

# File: src\routes.ts

```typescript
import { authRoutes } from '@/modules/authentication/authentication.routes';
import { Router } from 'express';
import { userRoutes } from './modules/users/users.routes';

export const routes = Router();

// Pluga as rotas do módulo de autenticação.
routes.use('/auth', authRoutes);
routes.use('/me', userRoutes);

```

# File: src\server.ts

```typescript
import { app } from './app/app';
import { env } from './env';

app.listen(env.SERVER_PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${env.SERVER_PORT}`);
});

```
