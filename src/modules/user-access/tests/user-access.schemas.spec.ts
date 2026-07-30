import { describe, expect, it } from 'vitest';
import { setUserPermissionsDTOSchema } from '../schemas/user-access.schemas';

describe('[UNIT TEST]: Módulo de User Access - Schemas', () => {
    describe('[schema]: setUserPermissionsDTOSchema', () => {
        it('deve passar na validação quando permissions é um array de UUIDs válidos', () => {
            const validUUID = crypto.randomUUID();
            const payload = {
                permissions: [validUUID],
            };

            const result = setUserPermissionsDTOSchema.safeParse(payload);
            expect(result.success).toBe(true);
        });

        it('deve falhar se permissions não for um array', () => {
            const payload = {
                permissions: 'nao-e-um-array',
            };

            const result = setUserPermissionsDTOSchema.safeParse(payload);
            expect(result.success).toBe(false);
        });

        it('deve falhar e retornar erro customizado se um item de permissions não for UUID', () => {
            const payload = {
                permissions: ['id-invalido-que-nao-e-uuid'],
            };

            const result = setUserPermissionsDTOSchema.safeParse(payload);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Cada ID de permissão deve ser um UUID válido.');
            }
        });
    });
});
