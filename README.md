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
