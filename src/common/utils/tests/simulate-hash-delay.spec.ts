import { IHashProvider } from '@/common/infra/providers/hash.provider';
import { env } from '@/env';
import { describe, expect, it, vi } from 'vitest';
import { simulateHashDelay } from '../simulate-hash-delay';

describe('[UNIT TEST]: Util - Simulate Hash Delay', () => {
    it('deve chamar o método hash do provider passando o DUMMY_HASH do ambiente', async () => {
        // Cria um provedor mockado
        const mockHashProvider: IHashProvider = {
            hash: vi.fn().mockResolvedValue('hashed-string-fake'),
            compare: vi.fn(),
        };

        await simulateHashDelay(mockHashProvider);

        // Garante que o método custoso de CPU foi chamado para absorver o tempo
        expect(mockHashProvider.hash).toHaveBeenCalledOnce();
        expect(mockHashProvider.hash).toHaveBeenCalledWith(env.DUMMY_HASH);
    });
});
