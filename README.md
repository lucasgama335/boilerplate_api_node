# 🚀 Node.js Secure Boilerplate API

Um boilerplate de API Node.js pronto para produção, construído com foco extremo em **Segurança**, **Performance** e **Arquitetura Limpa**.

Ideal para iniciar novos projetos sem precisar reescrever fluxos complexos de autenticação, proteção contra ataques ou configurações de banco de dados.

## ✨ Funcionalidades em Destaque

- **Autenticação Robusta:** Sistema completo de Login e Registro com JWT (Access Token) e Refresh Tokens rotativos (com hash no banco de dados).
- **Segurança Avançada:**
    - Proteção contra _Timing Attacks_ (Enumeração de Usuários) utilizando hashes dummy.
    - Criptografia de senhas utilizando Argon2.
    - Auditoria de segurança com registro de tentativas de login (Sucesso/Falha) para bloqueio de Força Bruta.
- **Rate Limiting Resiliente (Fail-Open):** Limitação de requisições por IP e por Conta utilizando **Redis**. Caso a infraestrutura do Redis caia, o sistema faz um _fallback_ automático e transparente para a memória local, garantindo que a API continue funcionando sem travar os usuários legítimos.
- **Arquitetura Limpa (Clean Architecture):** Separação clara de responsabilidades (Controllers, Services, Repositories, Domain) utilizando Injeção de Dependências (Composition Root).
- **Validação de Dados:** Middlewares dedicados para validação rigorosa de _inputs_.
- **Tratamento de Erros Centralizado:** Captura de exceções assíncronas de forma padronizada.

## 🛠️ Tecnologias Utilizadas

- **Linguagem:** TypeScript / Node.js
- **Framework HTTP:** Express
- **Banco de Dados:** PostgreSQL
- **ORM:** Drizzle ORM
- **Cache / Rate Limit:** Redis (ioredis + express-rate-limit)
- **Infraestrutura:** Docker & Docker Compose

---

## 📜 Scripts Disponíveis (Comandos Úteis)

No diretório raiz do projeto, você pode executar os seguintes comandos através do seu gerenciador de pacotes (npm, yarn, pnpm):

### 💻 Desenvolvimento

- `npm run dev`: Inicia o servidor em ambiente de desenvolvimento com hot-reload (tsx/ts-node-dev).
- `npm run build`: Transpila o código TypeScript para JavaScript na pasta de saída (ex: `dist`).
- `npm start`: Inicia o servidor para o ambiente de produção (necessário rodar o build antes).
- `npm run lint`: Executa o ESLint para encontrar e corrigir problemas de formatação no código.

### 🗄️ Banco de Dados (Drizzle ORM)

- `npm run db:generate`: Gera os arquivos SQL de migration baseados nas alterações feitas no seu `schema.ts`.
- `npm run db:push`: Aplica as alterações do schema diretamente no banco de dados (ideal para desenvolvimento rápido).
- `npm run db:migrate`: Executa as migrations geradas no banco de dados de forma segura.
- `npm run db:studio`: Abre o painel visual do Drizzle Studio no seu navegador para gerenciar as tabelas e dados facilmente.

## 🚀 Como começar

### Pré-requisitos

Certifique-se de ter instalado em sua máquina:

- [Node.js](https://nodejs.org/en/) (v18+ recomendado)
- [Docker e Docker Compose](https://www.docker.com/)

### 1. Clonando e Instalando

```bash
# Clone o repositório
git clone [https://github.com/seu-usuario/boilerplate-api.git](https://github.com/seu-usuario/boilerplate-api.git)

# Entre no diretório
cd boilerplate-api

# Instale as dependências
npm install
```

#DEV: dumpall src/ -o context.md -m "PROJECT DUMP"

# TODO

O que está sem nenhum teste — por risco

🔴 TokenValidityProvider (cache Redis)
Zero cobertura. É a mesma classe de risco do bug que já corrigimos: lógica de cache com serialização manual (cached === 'null' ? null : new Date(...)), fail-open silencioso quando o Redis cai, e invalidação de cache no revokeAllTokens. Se essa comparação de string tiver um erro sutil, o efeito é idêntico ao bug anterior — revogação que não revoga nada, ou pior, usuário revogado que nunca mais consegue acessar por cache não invalidado corretamente.

🔴 ensureAuthenticatedMiddleware
Middleware que decide "essa requisição está autenticada" para toda a API, e não tem um teste sequer. Casos que faltam: sem header, token inválido/expirado, token válido mas iat < revokedAt (sessão revogada), token válido normal injetando req.user.

🟠 AuthenticateController
Teria pego o bug do token/accessToken desalinhado que você já corrigiu. Vale testar o formato da resposta de cada ação (loginUser, refreshToken, logout, revokeAllUserTokens) e as chamadas de setRefreshTokenCookie/clearCookie, sem precisar de servidor HTTP de verdade (mocka req/res).

🟠 withFailOpen (rate limiter)
Lógica de decisão de segurança: só deve cair pro fallback em memória quando o erro é de infraestrutura (Redis fora do ar), nunca quando é um 429 legítimo do AppError. Se essa distinção quebrar, ou o rate limit para de funcionar (silencia erros de infra) ou passa a bloquear gente por engano.

🟡 authentication.schemas.ts (Zod)
Barato de testar e alto valor: regex de senha, normalização de e-mail, capitalização de nome, confirmação de senha. Validação de borda (senha sem maiúscula, sem caractere especial, passwordConfirmation diferente) é fácil de testar isolado.

🟢 errorHandler middleware
Mapeamento de status code por tipo de erro (AppError, ZodError, erro não tratado → 500 + Sentry). Baixo risco, mas rápido de cobrir.

🟢 TokenProvider
Roundtrip de generate/verify, e garantir que só aceita HS256 (proteção contra algorithm confusion attack).

Não recomendo priorizar HashProvider, GeolocationProvider e UserAgentProvider agora — são wrappers finos em cima de libs de terceiro, testar ali é testar a lib, não a sua lógica.
