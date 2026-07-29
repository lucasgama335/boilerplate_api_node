import { describe, expect, it } from 'vitest';
import { hashToken } from '../hash-token';

describe('[UNIT TEST]: Util - Hash Token', () => {
    it('deve converter uma string limpa em um hash hexadecimal seguro (SHA-256)', () => {
        const rawToken = 'my-random-string-token';
        const result = hashToken(rawToken);

        expect(typeof result).toBe('string');
        // SHA-256 sempre gera uma string hexadecimal de 64 caracteres
        expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('deve ser determinístico (a mesma string sempre gera o mesmo hash)', () => {
        const rawToken = 'my-deterministic-token';
        expect(hashToken(rawToken)).toBe(hashToken(rawToken));
    });

    it('deve gerar hashes completamente diferentes para strings diferentes', () => {
        const hash1 = hashToken('token-1');
        const hash2 = hashToken('token-2');

        expect(hash1).not.toBe(hash2);
    });
});
