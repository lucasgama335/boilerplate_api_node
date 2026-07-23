import 'dotenv/config';
import { app } from './app/app';

const PORT = process.env.SERVER_PORT;

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
