# Checklist de Testes Unitários — Cobertura 100%

Ordenado do módulo mais simples ao mais complexo. Testes que servem para travar os bugs já identificados na revisão de código estão marcados com 🔒.

---

# 1. Permissions

_(módulo mais simples: CRUD isolado, sem regra de negócio cross-módulo)_

## Services

- [ ] Testar que `list` calcula `totalPages` corretamente (incluindo o caso `total = 0` retornando `1`, não `0`);
- [ ] Testar `show` retornando a permissão quando encontrada;
- [ ] Testar `show` lançando `AppError 404` quando não encontrada;
- [ ] Testar `create` lançando `AppError 409` quando já existe permissão com o mesmo `code`;
- [ ] Testar `create` retornando a permissão criada com sucesso;
- [ ] Testar `update` lançando `AppError 400` quando o objeto de dados está vazio;
- [ ] Testar `update` lançando `AppError 404` quando a permissão não existe;
- [ ] Testar `update` retornando o registro atual **sem tocar no repositório** quando nenhum campo enviado é diferente do valor já salvo (otimização de "sem mudanças");
- [ ] Testar `update` lançando `AppError 409` quando o novo `code` já pertence a outra permissão;
- [ ] Testar `update` permitindo manter o mesmo `code` (não deve disparar checagem de duplicidade se `code` não mudou);
- [ ] Testar `update` retornando a permissão atualizada com sucesso;
- [ ] Testar `delete` lançando `AppError 404` quando não existe;
- [ ] Testar `delete` chamando o repositório com sucesso quando existe;

## Controller

- [ ] Testar `list` convertendo `page`/`limit` da query string para número antes de chamar o service;
- [ ] Testar `show` extraindo corretamente `req.params.id` quando vier como array (`Array.isArray`) vs string simples;
- [ ] Testar `create` retornando status `201` com o corpo `{ permission }`;
- [ ] Testar `update` retornando status `200` com o corpo `{ permission }`;
- [ ] Testar `delete` retornando status `200` com o corpo `{ permission }`;

## Schemas

- [ ] Testar `permissionsCreateSchema`: `code` é transformado para minúsculas (`USERS:CREATE` → `users:create`);
- [ ] Testar `permissionsCreateSchema`: `code` rejeitado se não seguir o padrão `recurso:ação`;
- [ ] Testar `permissionsCreateSchema`: `description` rejeitada com menos de 5 caracteres;
- [ ] Testar `permissionsCreateSchema`: `isActive` assume `true` por padrão quando omitido;
- [ ] Testar `permissionsUpdateSchema`: todos os campos são opcionais (objeto vazio é válido);
- [ ] Testar `permissionsUpdateSchema`: mesma validação de regex de `code` quando informado;

## Qualquer outra coisa (Repositório)

- [ ] Testar `findMany` retornando itens ordenados por `createdAt desc` e respeitando `limit`/`offset`;
- [ ] Testar `findMany` retornando `total` correto via `count()`;
- [ ] Testar `findById` retornando `null` quando não encontrado;
- [ ] Testar `findByCode` retornando `null` quando não encontrado;
- [ ] Testar `create` retornando o registro inserido;
- [ ] Testar `update` retornando `null` quando o `id` não existe (nenhuma linha afetada);
- [ ] Testar `delete` não lançando erro quando o `id` não existe;

---

# 2. Departments

_(CRUD + associação N:M com permissões e lógica de diff)_

## Services

- [ ] Testar `list` retornando departamentos com/sem permissões conforme o parâmetro `withPermissions`;
- [ ] Testar `list` calculando `totalPages` (incluindo `total = 0` → `1`);
- [ ] Testar `show` lançando `AppError 404` quando não encontrado;
- [ ] Testar `show` retornando o departamento com permissões;
- [ ] Testar `create` lançando `AppError 409` quando o nome já existe;
- [ ] Testar `create` lançando `AppError 400` quando algum ID de permissão informado não existe (`checkPermissionsExist` falso);
- [ ] Testar `create` funcionando sem nenhuma permissão informada (array vazio/omitido não deve chamar `checkPermissionsExist`);
- [ ] Testar `create` retornando o departamento criado com sucesso;
- [ ] Testar `update` lançando `AppError 400` quando o objeto de dados está vazio;
- [ ] Testar `update` lançando `AppError 404` quando o departamento não existe;
- [ ] Testar `update` lançando `AppError 400` quando alguma permissão nova não existe;
- [ ] Testar `update` **não** chamando o repositório quando não há mudança nem nos dados básicos nem nas permissões (comparação de arrays ordenados);
- [ ] Testar `update` detectando mudança de permissões mesmo quando a mudança é só na ordem/composição do array (ex.: remover uma permissão do meio);
- [ ] Testar `update` lançando `AppError 409` quando o novo nome já pertence a outro departamento;
- [ ] Testar `update` permitindo manter o mesmo nome sem disparar checagem de duplicidade;
- [ ] Testar `update` retornando o departamento atualizado com sucesso;
- [ ] 🔒 Testar `update` **invalidando o cache de permissões de todos os usuários afetados** quando o array de `permissions` do departamento muda (corrige o achado de cache stale da revisão anterior);
- [ ] Testar `delete` lançando `AppError 404` quando não existe;
- [ ] Testar `delete` chamando o repositório com sucesso quando existe;

## Controller

- [ ] Testar `list` convertendo `page`/`limit` da query;
- [ ] Testar `show`/`update`/`delete` extraindo `req.params.id` corretamente quando vier como array;
- [ ] Testar `create` incluindo `createdById` a partir de `req.user.id` no payload enviado ao service;
- [ ] Testar `update` incluindo `updatedById` a partir de `req.user.id` no payload enviado ao service;
- [ ] Testar `create` retornando `201`; `update`/`delete`/`show` retornando `200`;

## Schemas

- [ ] Testar `departmentsCreateSchema`: `name` rejeitado com menos de 2 ou mais de 100 caracteres;
- [ ] Testar `departmentsCreateSchema`: `description` aceita `null`/omitido e rejeita acima de 500 caracteres;
- [ ] Testar `departmentsCreateSchema`: `isActive` assume `true` por padrão;
- [ ] Testar `departmentsCreateSchema`: `permissions` rejeita UUID inválido no array;
- [ ] Testar `departmentsUpdateSchema`: todos os campos opcionais, incluindo `permissions`;

## Qualquer outra coisa (Repositório)

- [ ] Testar `findByName` retornando `null` quando não encontrado;
- [ ] Testar `findById(id, true)` retornando departamento com array de permissões via join;
- [ ] Testar `findById(id, false)` retornando departamento sem o campo `permissions`;
- [ ] Testar `findMany(..., true)` mapeando corretamente múltiplos departamentos para suas respectivas permissões (usando o `Map` de agrupamento) sem misturar permissões entre departamentos diferentes;
- [ ] Testar `findMany` retornando array vazio de permissões quando não há relações;
- [ ] Testar `checkPermissionsExist` retornando `true` para array vazio;
- [ ] Testar `checkPermissionsExist` retornando `false` quando algum ID não existe;
- [ ] Testar `create` inserindo o departamento e as relações de permissão dentro da mesma transação;
- [ ] Testar `create` sem permissões retornando `permissions: []`;
- [ ] Testar `update` substituindo completamente o conjunto de permissões (delete + insert) quando `permissionIds` é enviado;
- [ ] Testar `update` preservando as permissões existentes quando `permissionIds` não é enviado;
- [ ] Testar `update` buscando o registro atual sem escrever no banco quando `departmentData` está vazio mas `permissionIds` foi enviado;
- [ ] Testar `delete` não lançando erro quando o `id` não existe;

---

# 3. User-Access

_(módulo pequeno, mas crítico por tocar invalidação de cache)_

## Services

- [ ] Testar `setUserPermissions` lançando `AppError 404` quando o usuário não existe;
- [ ] Testar `setUserPermissions` lançando `AppError 400` quando a lista de permissões está vazia;
- [ ] Testar `setUserPermissions` lançando `AppError 400` quando algum ID de permissão não existe;
- [ ] Testar `setUserPermissions` chamando `setPermissions` do repositório com o `grantedById` correto;
- [ ] Testar `setUserPermissions` chamando `userPermissionsProvider.invalidatePermissions(id)` **sempre** após persistir com sucesso;
- [ ] Testar `setUserPermissions` retornando o usuário com as novas permissões;

## Controller

- [ ] Testar `create` extraindo `id` de `req.params.id`, `permissions` de `req.body` e `grantedById` de `req.user.id`;
- [ ] Testar `create` retornando status `201` com `{ user }`;

## Schemas

- [ ] Testar `setUserPermissionsDTOSchema`: `permissions` obrigatório e rejeitando UUID inválido no array;
- [ ] Testar `setUserPermissionsDTOSchema`: `permissions` aceitando array vazio no nível do schema (a regra de "não pode ser vazio" é do service, não do schema — vale um teste que comprove essa divisão de responsabilidade);
- [ ] Testar `setUserPermissionsDTOSchema`: `grantedById` opcional, rejeitando quando informado com UUID inválido;

## Qualquer outra coisa (Repositório)

- [ ] Testar `checkPermissionsExist` com array vazio retornando `true`;
- [ ] Testar `getPermissionsByUserId` retornando apenas IDs de permissões diretas (não herdadas);
- [ ] Testar `getPermissionsCode` retornando `['*']` imediatamente quando `isSuperUser = true`, sem executar o UNION;
- [ ] Testar `getPermissionsCode` retornando a união (sem duplicatas) de códigos diretos + herdados de departamento para usuário comum;
- [ ] Testar `getPermissionsCode` não duplicando um código que existe tanto direto quanto via departamento;
- [ ] Testar `setPermissions` removendo todas as permissões antigas antes de inserir as novas (dentro da mesma transação);
- [ ] Testar `setPermissions` com array vazio de permissões resultando em usuário sem nenhuma permissão direta;
- [ ] Testar `removePermission` removendo apenas a combinação exata `userId + permissionId`;
- [ ] Testar `removeAllPermissions` removendo todas as permissões diretas do usuário;

---

# 4. Users

_(cadastro, confirmação de e-mail, perfil — regra de negócio moderada)_

## Services

- [ ] Testar `getProfile` lançando `AppError 404` quando o usuário não existe;
- [ ] Testar `getProfile` retornando o usuário com departamentos e permissões efetivas;
- [ ] Testar `registerUser` chamando `hashProvider.hash` **antes** de checar se o e-mail existe (mitigação de timing attack — ordem importa, não só o resultado);
- [ ] Testar `registerUser` lançando `AppError 409` quando o e-mail já existe;
- [ ] Testar `registerUser` lançando `AppError 400` quando algum departamento informado não existe;
- [ ] Testar `registerUser` funcionando sem nenhum departamento informado;
- [ ] Testar `registerUser` nunca enviando o campo `password` cru para o repositório (deve enviar `passwordHash`);
- [ ] Testar `registerUser` gerando um token de confirmação de e-mail com `isEmailConfirmed = false`;
- [ ] Testar `confirmEmail` lançando `AppError 400` quando `decode` lança exceção (token malformado);
- [ ] Testar `confirmEmail` lançando `AppError 400` quando o payload decodificado não tem `sub` ou `purpose !== 'email-confirmation'`;
- [ ] Testar `confirmEmail` lançando `AppError 404` quando o usuário do token não existe;
- [ ] Testar `confirmEmail` lançando `AppError 400` quando o e-mail já está confirmado (idempotência);
- [ ] Testar `confirmEmail` lançando `AppError 401` quando `verifyEmailConfirmationToken` falha (assinatura/expiração);
- [ ] Testar `confirmEmail` chamando `userRepository.confirmEmail` apenas quando todas as validações passam;
- [ ] Testar `resendConfirmEmail` chamando `simulateHashDelay` mesmo quando o e-mail não existe;
- [ ] Testar `resendConfirmEmail` retornando silenciosamente (sem erro, sem gerar token) quando o e-mail não existe;
- [ ] Testar `resendConfirmEmail` retornando silenciosamente quando o e-mail já está confirmado (sem diferenciar da resposta de "não existe" — anti-enumeration);
- [ ] Testar `resendConfirmEmail` gerando novo token quando o e-mail existe e não está confirmado;

## Controller

- [ ] Testar `registerUser` retornando `201`;
- [ ] Testar `showProfile` usando `req.user.id` (não `req.params.id`);
- [ ] Testar `show` extraindo `req.params.id` corretamente quando vier como array;
- [ ] Testar `confirmEmail` extraindo `token` de `req.body` e retornando `200` com mensagem de sucesso;
- [ ] Testar `resendConfirmationEmail` extraindo `email` de `req.body` e retornando `200`;

## Schemas

- [ ] Testar `registerUserSchema`: `firstName`/`lastName` são capitalizados (primeira letra maiúscula) via `transform`;
- [ ] Testar `registerUserSchema`: `firstName`/`lastName` rejeitados com menos de 2 caracteres (após `trim`);
- [ ] Testar `registerUserSchema`: `email` normalizado para minúsculas;
- [ ] Testar `registerUserSchema`: `password` rejeitada sem maiúscula, sem caractere especial, ou com menos de 8 caracteres (testar cada regra isoladamente);
- [ ] Testar `registerUserSchema`: erro em `passwordConfirmation` quando não bate com `password` (`refine`);
- [ ] Testar `registerUserSchema`: `departments` opcional, rejeitando UUID inválido;
- [ ] Testar `confirmEmailSchema`: `token` rejeitado quando não bate com o formato de JWT;
- [ ] Testar `resendConfirmationEmailSchema`: `email` normalizado para minúsculas e rejeitado se inválido;

## Qualquer outra coisa (Repositório)

- [ ] Testar `checkDepartmentsExist` com array vazio retornando `true`;
- [ ] Testar `findByEmail(email, true)` retornando o usuário **com** `passwordHash`;
- [ ] Testar `findByEmail(email, false/omitido)` retornando o usuário **sem** `passwordHash`;
- [ ] Testar `findById` com o mesmo comportamento de sobrecarga acima;
- [ ] Testar `findByIdWithDetails` retornando `null` quando o usuário não existe;
- [ ] Testar `findByIdWithDetails` retornando **todas** as permissões quando `isSuperUser = true` (via `getEffectivePermissionsObjects`), sem consultar `userPermissions`/`userDepartments`;
- [ ] Testar `findByIdWithDetails` retornando a união de permissões diretas + herdadas por departamento para usuário comum;
- [ ] Testar `findByIdWithDetails` nunca incluindo `passwordHash` no retorno;
- [ ] Testar `create` vinculando departamentos dentro da mesma transação quando informados;
- [ ] Testar `create` retornando `departments: []` e `permissions: []` quando nenhum departamento é informado (novo usuário sem permissões herdadas);
- [ ] Testar `isUserSuperAdmin` retornando `false` quando o usuário não existe ou o campo é `false`;
- [ ] Testar `getTokensRevokedAt`/`setTokensRevokedAt` (leitura/escrita simples);
- [ ] Testar `updatePassword` setando `isEmailConfirmed = true` quando o parâmetro é omitido ou `false`;
- [ ] Testar `updatePassword` **não** alterando `isEmailConfirmed` quando já é `true` (evitar update desnecessário/regressão de estado);
- [ ] Testar `updatePassword` nunca retornando `passwordHash` no objeto de retorno;
- [ ] Testar `updateLastLogin` e `confirmEmail` (updates simples, incluindo bump de `updatedAt` em `confirmEmail`);

---

# 5. Infraestrutura Compartilhada (`src/app`)

_(usada por todos os módulos, mas concentra a lógica mais intrincada: cache com fail-open e segredo dinâmico de JWT — pré-requisito conceitual para testar Autenticação)_

## Providers

- [ ] **HashProvider**: testar `hash` gerando valor diferente do texto original; testar `compare` retornando `true`/`false` corretamente;
- [ ] **GeolocationProvider**: testar `lookup` retornando `{city, region, country}` para IP válido; testar retorno de objeto com todos os campos `null` para IP local/não resolvível (ex.: `::1`);
- [ ] **UserAgentProvider**: testar `parse` extraindo browser/os corretamente; testar `deviceType` assumindo `'desktop'` como fallback quando o parser não identifica o tipo;
- [ ] **TokenProvider.generate/verify**: testar geração e verificação de token de acesso padrão (`sub`, `HS256`, expiração);
- [ ] **TokenProvider.generatePasswordResetToken/verifyPasswordResetToken**: testar que o token só é válido com o **mesmo** `passwordHash` e `lastLoginAt` usados na geração; testar que **mudar qualquer um dos dois** (ex.: senha trocada ou novo login) invalida o token antigo (segredo dinâmico);
- [ ] **TokenProvider.generateEmailConfirmationToken/verifyEmailConfirmationToken**: testar que o token inclui `purpose: 'email-confirmation'`; testar que **mudar `isEmailConfirmed`** (de `false` para `true`) invalida o token antigo automaticamente;
- [ ] **TokenProvider.decode**: testar que decodifica sem validar assinatura (não deve lançar erro para token com assinatura inválida, só para token malformado);
- [ ] **UserPermissionsProvider.getPermissions**: testar cache hit (não consulta o repositório); testar cache miss (consulta repositório e grava no cache); testar fail-open na leitura (Redis lança erro → cai para o repositório sem lançar exceção); testar fail-open na escrita (falha ao gravar no cache não interrompe o retorno);
- [ ] **UserPermissionsProvider.invalidatePermissions**: testar que falha ao deletar do Redis não lança erro (fail-open);
- [ ] **UserSessionsRevocationProvider**: já coberto — apenas garantir que continua no CI;

## Middlewares

- [ ] **ensureAuthorizedMiddleware**: testar `401` quando `req.user` não existe (fallback de segurança); testar passagem direta (`next()`) quando `requiredPermissions` é vazio; testar passagem direta quando o usuário tem o wildcard `'*'`; testar `403` quando falta pelo menos uma permissão exigida (lógica AND); testar sucesso quando o usuário tem todas as permissões exigidas;
- [ ] **ensureEmailConfirmedMiddleware**: testar `401` quando não há `req.user`; testar `404` quando o usuário não existe no banco; testar `403` quando `isEmailConfirmed = false`; testar `next()` quando confirmado;
- [ ] **validateDataMiddleware / validateParamsMiddleware / validateQueryMiddleware**: testar que dado válido chama `next()` sem erro e popula `req.body`/`req.params`/`req.query` com o valor parseado (incluindo coerções/defaults do Zod); testar que dado inválido chama `next(error)` com `ZodError`, sem lançar diretamente; testar especificamente em `validate-query-middleware` que as chaves antigas de `req.query` são removidas antes de atribuir as novas (não deve sobrar chave órfã);
- [ ] **rate-limiter.middleware / with-fail-open**: testar que um erro de infraestrutura no Redis (não um `AppError`) faz a requisição cair para o limiter em memória (`fallback`) em vez de travar; testar que um `429` legítimo (`AppError`) do limiter primário **não** é convertido em fail-open (continua bloqueando); testar o throttle do alerta ao Sentry (não deve disparar mais de uma vez dentro do `REPORT_INTERVAL_MS` para o mesmo limiter); testar `resetLoginLimits` não lançando erro quando o Redis falha ao resetar (try/catch isolado por store);
- [ ] **error-handler-middleware**: já parcialmente coberto — adicionar: 🔒 testar que um erro de Postgres com código **não mapeado** em `KNOWN_POSTGRES_ERROR_CODES` também dispara `Sentry.captureException` (corrige a lacuna de observabilidade encontrada na revisão); testar `SyntaxError` com propriedade `body` retornando `400`;

## Utils

- [ ] **hashToken**: já coberto;
- [ ] **sanitizeBody**: já coberto para as 7 chaves atuais — 🔒 adicionar teste que force a lista `SENSITIVE_KEYS` a cobrir os nomes reais usados nos schemas hoje (`oldPassword`, `resetPasswordToken`), para não regredir silenciosamente quando um novo campo sensível for adicionado a um schema sem atualizar essa lista;
- [ ] **simulateHashDelay**: testar que chama `hashProvider.hash(env.DUMMY_HASH)` incondicionalmente;
- [ ] **setRefreshTokenCookie**: testar que `secure` é `true` apenas em produção; testar `sameSite: 'strict'`, `httpOnly: true` e `path` igual a `env.AUTH_ROUTE_PREFIX` sempre presentes;

---

# 6. Authentication

_(módulo mais complexo: rotação de refresh token, detecção de reuso, grace period, revogação em cascata)_

## Services

- [ ] **loginUser**: testar registro de tentativa `'fail'` quando o e-mail não existe; testar registro de tentativa `'fail'` quando a senha está errada; testar que ambos os casos usam a **mesma** mensagem de erro (`401`, "E-mail ou senha inválidos"); testar que `hashProvider.compare` é sempre chamado, mesmo quando o usuário não existe (contra `env.DUMMY_HASH`), garantindo tempo de resposta equivalente; testar bloqueio com a mesma mensagem genérica quando `isEmailConfirmed = false`; 🔒 testar (documentando o comportamento atual) se uma tentativa com e-mail não confirmado deve ou não gerar registro em `login_attempts` — usar esse teste para decidir/travar o comportamento desejado; testar que login bem-sucedido gera `token` + `refreshToken` (hash armazenado, valor cru retornado), atualiza `lastLoginAt`, grava tentativa `'success'` e chama `authRateLimiter.resetLoginLimits`;
- [ ] **refresh**: testar `401` quando token vazio; testar `401` quando token não encontrado; testar `401` quando expirado (`expiresAt` no passado); testar que reuso **além** do grace period revoga **todos** os refresh tokens do usuário e invalida todas as sessões (`userSessionRevocationProvider.revokeAllTokens`) antes de lançar `401`; testar que reuso **dentro** do grace period retorna um novo `accessToken` **sem** rotacionar o refresh token (`newRawRefreshToken: null`); testar rotação normal (token ainda ativo, sem `revokedAt`): revoga o token antigo, cria um novo, tudo dentro de uma única transação;
- [ ] **createResetPassword**: testar que `simulateHashDelay` é chamado tanto para e-mail existente quanto inexistente; testar retorno silencioso quando o usuário não existe; testar geração do token de reset com `passwordHash`/`lastLoginAt` atuais quando o usuário existe;
- [ ] **resetPassword**: testar `404` quando o usuário do token não existe; testar `401` quando `verifyPasswordResetToken` falha (assinatura/expiração/senha já trocada); testar que, com sucesso, a senha é atualizada **e** todas as sessões (`revokeAllTokens`) **e** todos os refresh tokens (`revokeAllTokensByUser`) do usuário são revogados;
- [ ] **changeAuthenthicatedUserPassword**: testar `401` quando o usuário (via `userId` do JWT) não existe mais no banco; testar `401` quando `oldPassword` não confere; testar que, com sucesso, todas as sessões são revogadas (`revokeAllTokens`) e um novo `accessToken` é emitido com `iat` posterior à revogação; testar a diferença entre informar `currentRefreshToken` (revoga todos **exceto** o atual, via `exceptHashedToken`) e não informar (revoga literalmente todos);
- [ ] **revokeByRawToken** (logout): testar `401` quando o token não é encontrado; testar revogação de **todos** os tokens do usuário quando o token já estava revogado **além** do grace period; 🔒 testar que, quando o token já estava revogado **dentro** do grace period, `revokedAt` **não é reescrito** (deve permanecer com o timestamp original, não avançar para "agora") — este é o teste que trava o bug de reset indevido do grace period encontrado na revisão; testar revogação normal de um token ainda ativo (fluxo padrão de logout);
- [ ] **revokeSessionsService**: testar que `userSessionRevocationProvider.revokeAllTokens` é sempre chamado primeiro, independente do parâmetro; testar `keepCurrentSession = true` com `currentRefreshToken` informado: mantém apenas o token atual vivo no banco e retorna um novo `accessToken` não nulo; testar `keepCurrentSession = true` **sem** `currentRefreshToken`: deve cair no comportamento de logout global (`accessToken: null`), não deve tentar preservar nada; testar `keepCurrentSession = false`: revoga literalmente todos os refresh tokens e retorna `accessToken: null`;

## Controller

- [ ] **loginUser**: testar que o cookie de refresh token é setado com o `refreshTokenExpiresAt` retornado pelo service; testar resposta `200` com `{ user, token }` (sem o refresh token no corpo);
- [ ] **refreshToken**: testar `401` quando não há cookie `refreshToken`; testar que o cookie é **atualizado** quando o service retorna `newRawRefreshToken`/`expiresAt`; testar que o cookie **não é tocado** quando o service retorna `newRawRefreshToken: null` (caso de grace period);
- [ ] **logout**: testar que uma falha em `revokeByRawToken` é **capturada e logada**, sem interromper a resposta (`204` sempre); testar que o cookie é limpo mesmo quando a revogação falha;
- [ ] **forgotPassword**: testar `200` sem corpo relevante, independente do e-mail existir ou não (não deve vazar diferença de status);
- [ ] **resetPassword**: testar extração de `resetPasswordToken`/`password` do body e resposta `200`;
- [ ] **changeAuthenthicatedUserPassword**: testar extração de `userId` (de `req.user.id`), `refreshToken` (do cookie) e `oldPassword`/`newPassword` (do body); testar resposta `200` com o usuário atualizado;
- [ ] **revokeAllUserTokens**: testar que, quando `accessToken` retornado é nulo (logout global), o cookie é limpo e a mensagem indica desconexão de todos os dispositivos; testar que, quando há `accessToken` (sessão atual preservada), o cookie **não** é limpo e a resposta inclui o novo token;

## Schemas

- [ ] Testar `authenticateUserSchema`: `email` normalizado para minúsculas; `password` obrigatória (mínimo 1 caractere, não valida complexidade aqui);
- [ ] Testar `forgotPasswordSchema`: mesma normalização de e-mail;
- [ ] Testar `refreshTokenSchema`: erro customizado quando `refreshToken` ausente;
- [ ] Testar `resetPasswordSchema`: `resetPasswordToken` rejeitado quando não bate com o formato de JWT; `password` com as mesmas regras de complexidade (maiúscula + especial + mínimo 8); erro em `passwordConfirmation` quando não bate com `password`;
- [ ] Testar `changePasswordUserSchema`: mesma validação de complexidade em `newPassword`; erro quando `passwordConfirmation` não bate; 🔒 erro específico quando `oldPassword === newPassword` (regra de negócio que impede repetir a mesma senha);
- [ ] Testar `logouAllDevicesSchema`: `keepCurrentSession` assume `false` por padrão;

## Qualquer outra coisa

**Repositórios**

- [ ] `LoginAttemptsRepository.generateAttempt`: testar inserção com `email`/`userId` nulos quando omitidos;
- [ ] `DrizzleRefreshsTokenRepository.create`: testar inserção retornando o `id`; testar aceitação de `TransactionClient` opcional (roda dentro de transação externa quando fornecido);
- [ ] `findByTokenHash`: testar retorno `null` quando não encontrado;
- [ ] `revokeToken`: testar que seta `revokedAt` e `updatedAt`;
- [ ] 🔒 `revokeAllTokensByUser`: testar que **somente** tokens com `revokedAt IS NULL` são afetados (não reverter a correção documentada no código-fonte — este é um teste de regressão explícito contra o bug histórico mencionado no comentário); testar o parâmetro `exceptHashedToken` excluindo corretamente um token específico da revogação em massa;
- [ ] `transaction`: testar que delega para `db.transaction`;

**Rate limiting específico de auth**

- [ ] `RateLimiterAdapter.resetLoginLimits`: testar que reseta a chave por e-mail tanto no limiter Redis quanto no de memória; testar que falha em qualquer um dos dois é capturada e logada sem lançar exceção (o comentário no código já deixa claro que resetar por IP foi deliberadamente desativado — vale um teste que documente/trave essa decisão).
