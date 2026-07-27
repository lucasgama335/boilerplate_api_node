import { app } from './app/app';
import { pool } from './database/index';
import { env } from './env';

async function startServer() {
    try {
        // Send a ping query to verify connection
        await pool.query('SELECT 1');
        console.log('📦 PostgreSQL connection successful.');

        // Start Express app only if query succeeds
        app.listen(env.SERVER_PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${env.SERVER_PORT}`);
        });
    } catch (error) {
        console.error('❌ Database connection failed. Server not started.');
        if (env.NODE_ENV === 'development') {
            console.error(error);
        }
        process.exit(1); // Kill the process
    }
}

startServer();
