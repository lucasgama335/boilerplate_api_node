import { describe, expect, it } from 'vitest';
import { hashToken } from './hash-token';

describe('Hash Token Utility', () => {
    it('deve retornar um hash criptografado para uma string limpa', () => {
        const plainToken = 'meu-token-secreto-123';

        const hashed = hashToken(plainToken);

        expect(hashed).toBeDefined();
        expect(hashed).not.toBe(plainToken);
        expect(typeof hashed).toBe('string');
    });

    it('deve gerar o mesmo hash para a mesma entrada (determinístico)', () => {
        const plainToken = 'token-de-teste';

        const hash1 = hashToken(plainToken);
        const hash2 = hashToken(plainToken);

        expect(hash1).toEqual(hash2);
    });

    it('deve gerar o diferentes hashs para a entradas diferentes', () => {
        const plainToken = 'token-de-teste';
        const plainToken2 = 'token-de-teste2';

        const hash1 = hashToken(plainToken);
        const hash2 = hashToken(plainToken2);

        expect(hash1).not.toEqual(hash2);
    });
});
