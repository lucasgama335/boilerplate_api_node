import { app } from './app/app';
import { env } from './env';

app.listen(env.SERVER_PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${env.SERVER_PORT}`);
});
