import { describe, expect, it } from 'vitest';
import { sanitizeBody } from '../sanitize-body';

interface IBodyResponse {
    password: string;
    passwordConfirmation: string;
    newPassword: string;
    currentPassword: string;
    token: string;
    refreshToken: string;
    totpSecret: string;
}

describe('SanitizeBody', () => {
    it('deve retornar o próprio valor recebido quando for diferente de um objeto', () => {
        const body = null;

        const result = sanitizeBody(body);

        expect(result).toBe(null);
    });

    it('deve retornar o body sem as propriedades listadas', () => {
        const reservedWords: (keyof IBodyResponse)[] = ['password', 'passwordConfirmation', 'newPassword', 'currentPassword', 'token', 'refreshToken', 'totpSecret'];
        const body: IBodyResponse = {
            password: 'test-password-123',
            passwordConfirmation: 'test-password-123',
            newPassword: 'test-password-123',
            currentPassword: 'test-password-123',
            token: 'asofaslça5645626a#56dad@56d',
            refreshToken: 'asofasl64562a6a#56dad@56d',
            totpSecret: 'asofaslça#56dad@56d',
        };

        const safeBody = sanitizeBody(body) as IBodyResponse;

        reservedWords.forEach((word) => {
            expect(safeBody[word]).toBe('[REDACTED]');
        });
    });
});
