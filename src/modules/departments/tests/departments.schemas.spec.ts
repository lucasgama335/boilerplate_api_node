import { describe, expect, it } from 'vitest';
import { departmentsCreateSchema, departmentsUpdateSchema } from '../schemas/departments.schemas';

describe('[UNIT TEST]: Módulo de Departamentos - Schemas', () => {
    describe('[schema]: departmentsCreateSchema', () => {
        describe('[property]: name', () => {
            it('deve retornar erro se o campo nome não estiver presente', () => {
                const payload = {
                    description: 'testando descrição',
                };

                const result = departmentsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);

                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O nome do departamento é obrigatório.');
                }
            });

            it('deve retornar erro se o campo nome tiver menos de 2 caracteres', () => {
                const payload = {
                    name: 'a',
                };

                const result = departmentsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O nome do departamento deve ter no mínimo 2 caracteres.');
                }
            });

            it('deve retornar erro se o campo nome tiver mais de 100 caracteres', () => {
                const payload = {
                    name: 'a'.repeat(101),
                };

                const result = departmentsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O nome do departamento deve ter no máximo 100 caracteres.');
                }
            });

            it('deve conseguir ser validado informado apenas o nome do departamento', () => {
                const payload = {
                    name: 'teste de departamento',
                };

                const result = departmentsCreateSchema.safeParse(payload);

                expect(result.success).toBe(true);
            });
        });

        describe('[property]: description', () => {
            it('deve retornar erro se o campo description tiver mais de 100 caracteres', () => {
                const payload = {
                    name: 'teste de departamento',
                    description: 'a'.repeat(501),
                };

                const result2 = departmentsCreateSchema.safeParse(payload);

                expect(result2.success).toBe(false);
                if (!result2.success) {
                    expect(result2.error.issues[0].message).toBe('A descrição deve ter no máximo 500 caracteres.');
                }
            });
        });

        describe('[property]: isActive', () => {
            it('deve retornar erro se o campo isActive tiver um tipo diferente de boolean', () => {
                const payload = {
                    name: 'teste de departamento',
                    isActive: 'teste',
                };

                const result2 = departmentsCreateSchema.safeParse(payload);

                expect(result2.success).toBe(false);
            });

            it('deve ser válido se um valor booleano válido for fornecido no payload', () => {
                const payload = {
                    name: 'teste de departamento',
                    isActive: false,
                };

                const result2 = departmentsCreateSchema.safeParse(payload);

                expect(result2.success).toBe(true);
            });
        });

        describe('[property]: permissions', () => {
            it('deve retornar erro se o permissions não for um array de string', () => {
                const payload = {
                    name: 'teste de departamento',
                    permissions: 'teste-asf',
                };

                const result = departmentsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);
            });

            it('deve retornar erro se o permissions não for um array com uuid válido', () => {
                const payload = {
                    name: 'teste de departamento',
                    permissions: ['1223'],
                };

                const result = departmentsCreateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Cada ID de permissão deve ser um UUID válido.');
                }
            });
        });
    });

    describe('[schema]: departmentsUpdateSchema', () => {
        it('deve ser válido se um objeto vazio for passado', () => {
            const result = departmentsUpdateSchema.safeParse({});

            expect(result.success).toBe(true);
        });

        describe('[property]: name', () => {
            it('deve retornar erro se o campo nome tiver menos de 2 caracteres', () => {
                const payload = {
                    name: 'a',
                };

                const result = departmentsUpdateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O nome do departamento deve ter no mínimo 2 caracteres.');
                }
            });

            it('deve retornar erro se o campo nome de tiver mais de 100 caracteres', () => {
                const payload = {
                    name: 'a'.repeat(101),
                };

                const result = departmentsUpdateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O nome do departamento deve ter no máximo 100 caracteres.');
                }
            });

            it('deve conseguir ser validado informado apenas o nome do departamento', () => {
                const payload = {
                    name: 'teste de departamento',
                };

                const result = departmentsUpdateSchema.safeParse(payload);

                expect(result.success).toBe(true);
            });
        });

        describe('[property]: description', () => {
            it('deve retornar erro se o description tiver mais de 500 caracteres', () => {
                const payload = {
                    name: 'teste de departamento',
                    description: 'a'.repeat(501),
                };

                const result2 = departmentsUpdateSchema.safeParse(payload);

                expect(result2.success).toBe(false);
                if (!result2.success) {
                    expect(result2.error.issues[0].message).toBe('A descrição deve ter no máximo 500 caracteres.');
                }
            });
        });

        describe('[property]: isActive', () => {
            it('deve retornar erro se o campo isActive tiver um tipo diferente de boolean', () => {
                const payload = {
                    name: 'teste de departamento',
                    isActive: 'teste',
                };

                const result2 = departmentsUpdateSchema.safeParse(payload);

                expect(result2.success).toBe(false);
            });

            it('deve ser válido se um valor booleano válido for fornecido no payload', () => {
                const payload = {
                    name: 'teste de departamento',
                    isActive: false,
                };

                const result2 = departmentsUpdateSchema.safeParse(payload);

                expect(result2.success).toBe(true);
            });
        });

        describe('[property]: permissions', () => {
            it('deve retornar erro se o permissions não for um array de string', () => {
                const payload = {
                    name: 'teste de departamento',
                    permissions: 'teste-asf',
                };

                const result = departmentsUpdateSchema.safeParse(payload);

                expect(result.success).toBe(false);
            });

            it('deve retornar erro se o permissions não for um array com uuid válido', () => {
                const payload = {
                    name: 'teste de departamento',
                    permissions: ['1223'],
                };

                const result = departmentsUpdateSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Cada ID de permissão deve ser um UUID válido.');
                }
            });
        });
    });
});
