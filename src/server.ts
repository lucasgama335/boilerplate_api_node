import { app } from './common/app';
import { testDatabaseConnection } from './database/index';
import { env } from './env';

async function startServer() {
    try {
        await testDatabaseConnection();
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
