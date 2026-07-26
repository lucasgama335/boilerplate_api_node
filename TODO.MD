# Checklist — Sistema de Autorização (Matrícula em Departamento + Permissão Manual)

## Fase 0 — Migration

- [ ] Criar migration adicionando índice único em `user_permissions` na combinação `(user_id, permission_id)`
- [ ] Rodar a migration localmente e confirmar que tentar inserir duplicata (mesmo user + permission, fontes diferentes) é rejeitado pelo banco

## Fase 1 — Tratamento de erros de banco (error handler)

- [ ] Adicionar em `error-handler-middleware.ts` o branch de erros conhecidos do Postgres (`23505`, `23503`, `23502`, `22P02`) antes do branch genérico
- [ ] Confirmar que erros reconhecidos (ex: `23505`) **não** disparam Sentry, só `logger.warn`
- [ ] Confirmar que erros não reconhecidos continuam caindo no branch genérico (log + Sentry)
- [ ] Teste manual: forçar uma violação de unique (duas requisições concorrentes concedendo a mesma permissão) e confirmar resposta 409 limpa, sem 500

## Fase 2 — Ajustar `registerUser`

- [ ] `registerUserSchema`: remover `password`/`passwordConfirmation`, manter só `firstName`, `lastName`, `email`
- [ ] `usersRoutes`: confirmar `authMiddleware`, `authorize(['users:create'])`, `registerRequestIpLimiter`, `validateDataMiddleware(registerUserSchema)`
- [ ] `usersService.registerUser`: gerar senha aleatória inutilizável (ex: hash de um UUID) no lugar do `password` do body
- [ ] `usersService.registerUser`: gerar token de convite reaproveitando `generatePasswordResetToken`
- [ ] `usersService.registerUser`: logar o token no console em dev (`NODE_ENV === 'development'`) + `TODO` de e-mail em produção
- [ ] Atualizar `users.services.spec.ts` — remover asserções de senha do body, adicionar teste confirmando geração do token de convite

## Fase 3 — Ajustar `resetPassword`

- [ ] `authentication.service.ts` → `resetPassword`: adicionar `isEmailConfirmed: true` na atualização do usuário junto da troca de senha
- [ ] Atualizar `authentication.services.spec.ts` — teste confirmando que `isEmailConfirmed` vira `true` após reset bem-sucedido

## Fase 4 — Script de bootstrap

- [ ] Criar `scripts/create-superuser.ts`
- [ ] Prompt interativo: nome, e-mail, senha (validar com a mesma regra de complexidade do schema de senha)
- [ ] Hash da senha via `HashProvider` já existente
- [ ] Insert direto no banco: `isSuperUser: true`, `isEmailConfirmed: true`
- [ ] Adicionar script no `package.json` (`"create-superuser": "tsx scripts/create-superuser.ts"`)
- [ ] Rodar localmente e confirmar login funcionando com a conta criada

## Fase 5 — Cadastro da permissão `user-access:manage`

- [ ] Logar com o superuser criado na Fase 4
- [ ] Criar a permissão `user-access:manage` via `POST /permissions` (ou incluir num seed, se preferir automatizar)
- [ ] Confirmar que `isSuperUser` já ignora a checagem de permissão granular (bypass), dispensando concessão manual pro próprio superuser

## Fase 6 — Módulo `user-access`

- [ ] `user-access.types.ts` — `AssignDepartmentDTO`, `GrantPermissionDTO`
- [ ] `user-access.schemas.ts` — validação de `departmentId`/`permissionId` (UUID)
- [ ] `user-access.service.ts`:
    - [ ] `assignUserToDepartment` (valida existência, checa duplicata, busca permissões do departamento, transação, invalida cache)
    - [ ] `removeUserFromDepartment` (valida matrícula, transação com `removePermissionsByDepartment`, invalida cache)
    - [ ] `grantManualPermission` (valida permissão ativa + não duplicada, grava, invalida cache)
    - [ ] `revokeManualPermission` (remove linha `source: 'manual'`, invalida cache)
- [ ] `user-access.controller.ts` — 4 handlers
- [ ] `user-access.routes.ts` — 4 rotas, todas com `authMiddleware` + `authorize(['user-access:manage'])`
- [ ] `user-access.composition.ts` — wiring de todos os repositórios + `userPermissionsProvider`
- [ ] Registrar `userAccessRoutes` no `src/routes.ts` (montado sob `/users`)

## Fase 7 — Testes do módulo novo

- [ ] `assignUserToDepartment`: caso feliz, departamento não existe, usuário não existe, já matriculado, permissão já existente como `manual` (deve pular, não duplicar)
- [ ] `removeUserFromDepartment`: caso feliz, matrícula não existe, confirma que `manual` não é afetada
- [ ] `grantManualPermission` / `revokeManualPermission`: caso feliz, permissão inativa, permissão duplicada
- [ ] Confirmar em todos os casos que `invalidatePermissions` é chamado **depois** do commit (nunca antes de erro/rollback)

## Fase 8 — Validação manual ponta a ponta

- [ ] Rodar bootstrap → logar como superuser
- [ ] Criar permissão `user-access:manage`
- [ ] Criar um usuário via `/register` → pegar o token do console
- [ ] Definir senha via `/reset-password` → confirmar `isEmailConfirmed` virou `true`
- [ ] Matricular esse usuário num departamento → confirmar que ele consegue acessar rota protegida por permissão do departamento
- [ ] Desmatricular → confirmar que o acesso cai (dentro do TTL do cache ou após invalidação)

---

## Regras de negócio já fechadas (não revisitar)

- **Departamento deletado** → matrícula cai em cascata; permissões já concedidas **permanecem** (`originDepartmentId` → `NULL`)
- **Usuário desmatriculado** (departamento continua existindo) → permissões daquele departamento **são removidas**; permissões manuais ficam intactas
- **Conflito de fonte**: uma permissão nunca duplica pro mesmo usuário — quem chegou primeiro fica
- Invalidação de cache sempre **depois** do commit da transação, nunca dentro dela
