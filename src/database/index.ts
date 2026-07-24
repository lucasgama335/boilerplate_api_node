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
