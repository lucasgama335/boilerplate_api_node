# API Backend - TypeScript & Express

Este projeto é um boilerplate de API robusto desenvolvido em **Node.js** com **TypeScript** e **Express**, estruturado com base em princípios de Arquitetura Limpa, Domain-Driven Design (DDD) leve e foco rigoroso em segurança, resiliência e testabilidade.

---

## 🚀 Tecnologias e Stack

- **Linguagem:** TypeScript
- **Framework HTTP:** Express[cite: 1]
- **Banco de Dados & ORM:** PostgreSQL[cite: 1] com **Drizzle ORM**[cite: 1]
- **Validação de Dados:** Zod[cite: 1]
- **Segurança & Criptografia:** Argon2 (hashing de senhas)[cite: 1], JSON Web Token (JWT)[cite: 1] e Crypto (SHA-256 para hash de tokens de sessão)[cite: 1]
- **Cache & Rate Limiting:** Redis (via ioredis)[cite: 1] com estratégia de **Fail-Open** (fallback automático em memória)[cite: 1]
- **Observabilidade & Logs:** Pino (com rotação diária de logs e tarja de segurança contra vazamento de dados sensíveis)[cite: 1] e Sentry[cite: 1]
- **Testes:** Vitest[cite: 1] com repositórios em memória (_In-Memory Repositories_)[cite: 1]

---

## 🛡️ Arquitetura e Padrões de Segurança

- **Anti-Timing Attack:** Mitigação contra ataques de enumeração de e-mails em rotas sensíveis (como registro e recuperação de senha), executando o custo computacional do hash de forma incondicional[cite: 1].
- **Rate Limiting em Camadas:** Proteção contra força bruta em rotas críticas (Login, Refresh Token, Recuperação de Senha, Confirmação de E-mail) aplicando limites tanto por Endereço IP quanto por Conta de E-mail/ID de Usuário[cite: 1].
- **Gestão de Sessões & Refresh Tokens:** Rotação de tokens de atualização com janela de tolerância (_grace period_) para detecção de reuso malicioso e suporte a revogação global ou seletiva de dispositivos[cite: 1].
- **Controle de Acesso Baseado em Permissões (RBAC):** Sistema granular de permissões atreladas diretamente aos usuários ou herdadas via departamentos, otimizado com cache em Redis e padrão _fail-open_[cite: 1].

---

## 📁 Estrutura do Projeto

```text
src/
├── @types/                 # Extensões de tipagens globais do Express (ex: Request user)[cite: 1]
├── app/
│   ├── app.ts              # Configuração central do Express, Sentry e Middlewares globais[cite: 1]
│   ├── composition-root.ts # Injeção de dependências e instâncias globais de infra[cite: 1]
│   ├── exceptions/         # Tratamento customizado de Erros Operacionais (AppError)[cite: 1]
│   ├── http/               # Middlewares (Auth, Permissões, Validação Zod, Rate Limiter, Error Handler)[cite: 1]
│   ├── infra/              # Provedores externos (Hash, Token, Redis, Geolocation, UserAgent, Sentry)[cite: 1]
│   ├── schemas/            # Schemas utilitários globais (Paginação, UUID params)[cite: 1]
│   └── utils/              # Funções utilitárias (Logger, Sanitizadores, Simulação de delay)[cite: 1]
├── database/
│   ├── index.ts            # Conexão com o Pool do PostgreSQL e Drizzle[cite: 1]
│   ├── repositories.ts     # Centralização de instâncias dos repositórios do banco[cite: 1]
│   └── schema.ts           # Definição das tabelas relacionais e enums do Drizzle[cite: 1]
├── env/                    # Validação estrita de variáveis de ambiente com Zod[cite: 1]
├── modules/                # Módulos de Domínio (Authentication, Users, Departments, Permissions, UserAccess)[cite: 1]
├── routes.ts               # Hub centralizador e unificado de rotas da API[cite: 1]
└── server.ts               # Inicialização da aplicação e verificação de saúde do banco[cite: 1]
```

## AI TIP:

npx dumpall ./ -o context.md -e ".vscode" -e "dist" -e "logs" -e "node_modules" -e ".env.example" -e ".env.test" -e ".gitignore" -e ".prettierrc" -e "context.md" -e "eslint.config.msj" -e "package-lock.json" -e "README.md" -e "TODO.MD" -e "prompt.pdf"

Foi anexado a esta conversa um dump completo do código-fonte da aplicação. Sua tarefa é realizar um Code Review completo e sistemático, seguindo rigorosamente todas as diretrizes definidas no Prompt Mestre. Não resuma a análise, não faça uma revisão superficial e não assuma nada sem verificar. Leia efetivamente todos os arquivos necessários para entender como a aplicação funciona antes de emitir conclusões.
