# API Backend - TypeScript & Express

Este projeto é um boilerplate de API robusto desenvolvido em **Node.js** com **TypeScript** e **Express**, estruturado com base em princípios de Arquitetura Limpa, Domain-Driven Design (DDD) leve e foco rigoroso em segurança, resiliência e testabilidade.

---

## 🚀 Tecnologias e Stack

- **Linguagem:** TypeScript
- **Framework HTTP:** Express
- **Banco de Dados & ORM:** PostgreSQL com **Drizzle ORM**
- **Validação de Dados:** Zod
- **Segurança & Criptografia:** Argon2 (hashing de senhas), JSON Web Token (JWT) e Crypto (SHA-256 para hash de tokens de sessão)
- **Cache & Rate Limiting:** Redis (via ioredis) com estratégia de **Fail-Open** (fallback automático em memória)
- **Observabilidade & Logs:** Pino (com rotação diária de logs e tarja de segurança contra vazamento de dados sensíveis) e Sentry
- **Testes:** Vitest com repositórios em memória (_In-Memory Repositories_)

---

## 🛡️ Arquitetura e Padrões de Segurança

- **Anti-Timing Attack:** Mitigação contra ataques de enumeração de e-mails em rotas sensíveis (como registro e recuperação de senha), executando o custo computacional do hash de forma incondicional.
- **Rate Limiting em Camadas:** Proteção contra força bruta em rotas críticas (Login, Refresh Token, Recuperação de Senha, Confirmação de E-mail) aplicando limites tanto por Endereço IP quanto por Conta de E-mail/ID de Usuário.
- **Gestão de Sessões & Refresh Tokens:** Rotação de tokens de atualização com janela de tolerância (_grace period_) para detecção de reuso malicioso e suporte a revogação global ou seletiva de dispositivos.
- **Controle de Acesso Baseado em Permissões (RBAC):** Sistema granular de permissões atreladas diretamente aos usuários ou herdadas via departamentos, otimizado com cache em Redis e padrão _fail-open_.

---

## 📁 Estrutura do Projeto

```text
src/
├── @types/                 # Extensões de tipagens globais do Express (ex: Request user)
├── app/
│   ├── app.ts              # Configuração central do Express, Sentry e Middlewares globais
│   ├── composition-root.ts # Injeção de dependências e instâncias globais de infra
│   ├── exceptions/         # Tratamento customizado de Erros Operacionais (AppError)
│   ├── http/               # Middlewares (Auth, Permissões, Validação Zod, Rate Limiter, Error Handler)
│   ├── infra/              # Provedores externos (Hash, Token, Redis, Geolocation, UserAgent, Sentry)
│   ├── schemas/            # Schemas utilitários globais (Paginação, UUID params)
│   └── utils/              # Funções utilitárias (Logger, Sanitizadores, Simulação de delay)
├── database/
│   ├── index.ts            # Conexão com o Pool do PostgreSQL e Drizzle
│   ├── repositories.ts     # Centralização de instâncias dos repositórios do banco
│   └── schema.ts           # Definição das tabelas relacionais e enums do Drizzle
├── env/                    # Validação estrita de variáveis de ambiente com Zod
├── modules/                # Módulos de Domínio (Authentication, Users, Departments, Permissions, UserAccess)
├── routes.ts               # Hub centralizador e unificado de rotas da API
└── server.ts               # Inicialização da aplicação e verificação de saúde do banco
```
