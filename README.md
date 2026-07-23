# 🚀 Secure Node.js Boilerplate API

## 📌 Sobre o Projeto

Este é um boilerplate moderno, seguro e escalável para APIs em Node.js com TypeScript. O objetivo é servir como uma fundação robusta e reutilizável para projetos futuros, abstraindo a configuração inicial e garantindo as melhores práticas de segurança e engenharia de software desde o dia zero.

## 🧠 Nossa Filosofia de Arquitetura

- **Controle e Transparência:** Rejeitamos "caixas pretas" e ferramentas que tentam sequestrar a infraestrutura. Preferimos ferramentas limpas, transparentes e baseadas em código (Code-First), mantendo o domínio total sobre o nosso repositório.
- **Manutenibilidade:** Foco em tipagem forte (TypeScript ponta a ponta) para que o projeto possa ser mantido com facilidade e segurança por um único desenvolvedor a longo prazo.
- **Segurança por Padrão (Security-First):**
    - Uso de UUIDs como chaves primárias para evitar ataques de enumeração (IDOR).
    - Nomes explícitos no banco (ex: `password_hash`) para evitar vazamento acidental.
    - Deleção em cascata (`CASCADE`) para não deixar dados órfãos de sessões de usuários removidos.
- **Produtividade sem Magia:** Arquitetura SQL-like previsível sem o _overhead_ de decorators manuais, unindo a velocidade de desenvolvimento ao controle fino do banco de dados.

## 📦 Dependências (Stack Atual)

A fundação foi construída de forma enxuta, focando em performance, modernidade e ausência de atrito.

**Produção (`dependencies`):**

- `express`: Framework web minimalista e flexível para a criação da API.
- `cors`: Middleware para gerenciar permissões de acesso externo à API.
- `drizzle-orm`: ORM moderno, tipado e extremamente leve (Zero interferência no terminal).
- `pg`: Driver nativo do PostgreSQL para Node.js.
- `dotenv`: Gerenciamento de variáveis de ambiente.
- `argon2`: Padrão-ouro moderno para hash de senhas (resistente a ataques de GPU/hardware).
- `zod`: Validação e sanitização de dados com inferência de tipos (Schema declaration).

**Desenvolvimento (`devDependencies`):**

- `typescript`: Tipagem estática estrutural do projeto.
- `drizzle-kit`: CLI para gerenciamento e geração das migrações do banco de dados.
- `tsx`: Execução de TypeScript nativo com hot-reload (uma alternativa superior e mais rápida ao nodemon + ts-node).
- `@types/node`, `@types/pg`, `@types/express`, `@types/cors`: Definições de tipos da stack.

## ⌨️ Atalhos de Comandos (`scripts`)

Os comandos foram encapsulados no `package.json` para servir como documentação viva e painel de controle do banco de dados:

- **`npm run dev`** → Inicia o servidor de desenvolvimento com hot-reload (observando alterações via `tsx`).
- **`npm run db:push`** → Sincroniza o esquema TypeScript diretamente com o banco de dados. (Modo Prototipagem Rápida: ideal para testes locais).
- **`npm run db:generate`** → Lê o `schema.ts` e gera o arquivo SQL de migração oficial e versionado na pasta `drizzle`.
- **`npm run db:migrate`** → Executa os arquivos SQL gerados no banco de dados para atualizar a estrutura de forma definitiva e segura (Modo Produção Seguro).
- **`npm run db:studio`** → Ferramenta de interface gráfica de visualização de banco de dados do drizzle-orm.

## 🎯 To-Do List: Módulo de Autenticação (Fase Atual)

Os passos pragmáticos para finalizarmos o fluxo de segurança do usuário:

- [x] **1. Decisão Criptográfica:**
    - [x] Escolher e instalar a biblioteca de hash para a senha (Bcrypt ou Argon2).
- [ ] **2. Criação do Serviço de Registro (`AuthService.registerUser`):**
    - [ ] Validar a inexistência prévia do e-mail no banco de dados.
    - [ ] Gerar o hash da senha de forma segura.
    - [ ] Salvar o novo usuário (`firstName`, `lastName`, `email`, `passwordHash`) usando o Drizzle.
    - [ ] Retornar o objeto do usuário garantindo a remoção/omissão do `passwordHash` na resposta.
- [ ] **3. Criação do Fluxo de Login (`AuthService.loginUser`):**
    - [ ] Buscar o usuário no banco pelo e-mail.
    - [ ] Comparar a senha fornecida com o hash armazenado.
- [ ] **4. Estratégia de Sessão e Tokens:**
    - [ ] Implementar geração de Access Tokens (JWT de curta duração) para uso nas rotas.
    - [ ] Implementar geração e persistência de Refresh Tokens (longa duração) na tabela `refresh_tokens`.
- [ ] **5. Proteção de Rotas (Middleware):**
    - [ ] Criar o middleware de autenticação para validar o JWT nos cabeçalhos (Headers) das requisições privadas.
