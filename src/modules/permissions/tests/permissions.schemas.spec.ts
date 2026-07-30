import { describe, expect, it } from 'vitest';
import { permissionsCreateSchema, permissionsUpdateSchema } from '../schemas/permissions.schemas';

describe('[UNIT TEST]: Módulo de Permissões - Schemas', () => {
    describe('permissionsCreateSchema', () => {
        describe('[property]: code', () => {
            it('o campo code é obrigatório deve retornar um erro de validão quando não for passado', () => {
                const payload = {
                    description: 'olaafsa',
                };

                const result = permissionsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O código é obrigatório');
                }
            });

            it('deve transformar o code para minúsculas', () => {
                const payload = {
                    code: 'USERS:CREATE',
                    description: 'Criar usuários',
                };

                const result = permissionsCreateSchema.safeParse(payload);

                expect(result.success).toBe(true);

                if (result.success) {
                    expect(result.data.code).toBe('users:create');
                }
            });

            it('deve rejeitar o code se não seguir o padrão recurso:acao', () => {
                const payload = {
                    code: 'users',
                    description: 'Criar usuários',
                };

                const result = permissionsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Formato inválido. O código deve seguir o padrão recurso:ação (ex: users:create)');
                }
            });
        });

        describe('[property]: description', () => {
            it('deve rejeitar um description com menos de 5 caracteres', () => {
                const payload = {
                    code: 'users:create',
                    description: 'ola',
                };

                const result = permissionsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O campo description deve ao menos ter 5 caracteres');
                }
            });

            it('o campo description é obrigatório deve retornar um erro de validão quando não for passado', () => {
                const payload = {
                    code: 'users:create',
                };

                const result = permissionsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O campo description é obrigatório.');
                }
            });
        });
    });

    describe('permissionsUpdateSchema', () => {
        it('todos as propriedades são opcionais, logo um objeto vazio é válido', () => {
            const result = permissionsUpdateSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        describe('[property]: code', () => {
            it('deve rejeitar o code se não seguir o padrão recurso:acao', () => {
                const payload = {
                    code: 'users',
                    description: 'Criar usuários',
                };

                const result = permissionsUpdateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Formato inválido. O código deve seguir o padrão recurso:ação (ex: users:create)');
                }
            });
        });
    });
});
