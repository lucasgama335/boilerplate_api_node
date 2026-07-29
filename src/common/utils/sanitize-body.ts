// Lista de chaves que nunca devem ir pra um log ou pro Sentry, mesmo em caso de erro.
// Se adicionar um novo campo sensível em algum schema (ex: novo campo de PIX, CPF, etc.),
// adicione aqui também.
const SENSITIVE_KEYS = new Set(['password', 'passwordConfirmation', 'newPassword', 'currentPassword', 'token', 'refreshToken', 'totpSecret', 'oldPassword', 'resetPasswordToken']);

export function sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    if (Array.isArray(body)) return body.map(sanitizeBody);

    return Object.fromEntries(
        Object.entries(body as Record<string, unknown>).map(([key, value]) => {
            if (SENSITIVE_KEYS.has(key)) return [key, '[REDACTED]'];
            return [key, typeof value === 'object' ? sanitizeBody(value) : value];
        }),
    );
}
