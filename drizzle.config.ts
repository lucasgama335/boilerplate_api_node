import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/database/schema.ts',
    out: './drizzle', // Pasta onde os arquivos SQL das migrações serão gerados
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL as string,
    },
});
