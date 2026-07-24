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
