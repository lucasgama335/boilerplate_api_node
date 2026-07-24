import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true, // Permite usar describe, it, expect sem importar em cada arquivo
        environment: 'node',
        // Define os aliases para o Vitest entender o @/ do TypeScript
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        // Pastas que o Vitest deve ignorar
        exclude: ['node_modules', 'dist', 'logs'],
    },
});
