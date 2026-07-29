import { describe, expect, it } from 'vitest';
import { sanitizeBody } from '../sanitize-body';

describe('[UNIT TEST]: Util - Sanitize Body', () => {
    it('deve retornar o mesmo valor se a entrada não for um objeto ou array', () => {
        expect(sanitizeBody('simples string')).toBe('simples string');
        expect(sanitizeBody(123)).toBe(123);
        expect(sanitizeBody(null)).toBeNull();
        expect(sanitizeBody(undefined)).toBeUndefined();
    });

    it('deve retornar o objeto intacto se não houver propriedades sensíveis', () => {
        const payload = { name: 'John Doe', age: 30, isAdmin: true };
        const result = sanitizeBody(payload);

        expect(result).toEqual(payload);
    });

    it('deve substituir o valor de propriedades sensíveis no primeiro nível por [REDACTED]', () => {
        const payload = {
            email: 'test@example.com',
            password: 'secretPassword123!',
            token: 'eyJhbGci...',
        };

        const result = sanitizeBody(payload);

        expect(result).toEqual({
            email: 'test@example.com',
            password: '[REDACTED]',
            token: '[REDACTED]',
        });
    });

    it('deve aplicar a sanitização recursivamente em objetos profundamente aninhados', () => {
        const payload = {
            user: {
                id: 1,
                passwordConfirmation: 'secretPassword123!',
                settings: { theme: 'dark', resetPasswordToken: 'xyz123' },
            },
        };

        const result = sanitizeBody(payload);

        expect(result).toEqual({
            user: {
                id: 1,
                passwordConfirmation: '[REDACTED]',
                settings: { theme: 'dark', resetPasswordToken: '[REDACTED]' },
            },
        });
    });

    it('deve aplicar a sanitização dentro de estruturas de array iterando corretamente', () => {
        const payload = [
            { id: 1, currentPassword: 'p1' },
            { id: 2, newPassword: 'p2' },
        ];

        const result = sanitizeBody(payload);

        expect(result).toEqual([
            { id: 1, currentPassword: '[REDACTED]' },
            { id: 2, newPassword: '[REDACTED]' },
        ]);
    });

    it('deve redigir o campo oldPassword (nome real usado em changePasswordUserSchema, não currentPassword)', () => {
        const payload = { oldPassword: 'senha-antiga-123', newPassword: 'senha-nova-456' };
        const result = sanitizeBody(payload);

        expect(result).toEqual({ oldPassword: '[REDACTED]', newPassword: '[REDACTED]' });
    });
});
