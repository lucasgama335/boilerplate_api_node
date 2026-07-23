import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Cria o pool de conexões com o banco
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Inicializa o ORM
export const db = drizzle(pool);
