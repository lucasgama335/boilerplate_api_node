// Lista de chaves que nunca devem ir pra um log ou pro Sentry, mesmo em caso de erro.
// Se adicionar um novo campo sensível em algum schema (ex: novo campo de PIX, CPF, etc.),
// adicione aqui também.
const SENSITIVE_KEYS = new Set(['password', 'passwordConfirmation', 'newPassword', 'currentPassword', 'token', 'refreshToken', 'totpSecret']);

export function sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
        return body;
    }

    return Object.fromEntries(Object.entries(body as Record<string, unknown>).map(([key, value]) => [key, SENSITIVE_KEYS.has(key) ? '[REDACTED]' : value]));
}
