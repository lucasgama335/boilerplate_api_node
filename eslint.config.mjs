import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier, // Deve vir sempre por último para sobrescrever regras visuais
    {
        rules: {
            // Aqui você pode endurecer ou afrouxar regras.
            // Como queremos um código seguro, vamos proibir o "any":
            '@typescript-eslint/no-explicit-any': 'error',

            // Avisa se houver variáveis declaradas e não usadas (ajuda a limpar o código)
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    {
        // Ignora a pasta de build para o linter não analisar código compilado
        ignores: ['dist/', 'node_modules/'],
    },
);
