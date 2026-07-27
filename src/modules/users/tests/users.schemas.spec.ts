import { describe, expect, it } from 'vitest';
import { confirmEmailSchema, registerUserSchema, resendConfirmationEmailSchema } from '../schemas/users.schemas';

describe('[UNIT TEST]: Módulo de Usuários - Schemas', () => {
    describe('[schema]: registerUserSchema', () => {
        describe('[property]: firstName', () => {
            it('deve retornar erro quando o campo firstName tiver menos de 2 caracteres', () => {
                const payload = {
                    firstName: 'A',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'passworD@123',
                    passwordConfirmation: 'passworD@123',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O nome deve ter no mínimo 2 caracteres');
                }
            });
        });

        describe('[property]: lastName', () => {
            it('deve retornar erro quando o campo lastName tiver menos de 2 caracteres', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'D',
                    email: 'test@example.com',
                    password: 'passworD@123',
                    passwordConfirmation: 'passworD@123',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O sobrenome deve ter no mínimo 2 caracteres');
                }
            });
        });

        describe('[property]: email', () => {
            it('deve retornar erro quando o campo email não for um email válido', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'testexample.com',
                    password: 'passworD@123',
                    passwordConfirmation: 'passworD@123',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
                }
            });
        });

        describe('[property]: password', () => {
            it('deve retornar erro quando o campo password tiver menos de 8 caracteres', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'pass',
                    passwordConfirmation: 'pass',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('A senha deve ter no mínimo 8 caracteres');
                }
            });

            it('deve retornar erro quando o campo password não tiver nenhuma letra maiúscula', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'password@3654',
                    passwordConfirmation: 'password@3654',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('A senha deve conter pelo menos uma letra maiúscula');
                }
            });

            it('deve retornar erro quando o campo password não tiver nenhum caractere especial', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'passworD3654',
                    passwordConfirmation: 'passworD3654',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('A senha deve conter pelo menos um caractere especial');
                }
            });
        });

        describe('[property]: passwordConfirmation', () => {
            it('deve retornar erro quando o campo passwordConfirmation não estiver presente', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'passworD@1546',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O campo de confirmação de senha é obrigatório, mas não foi encontrado');
                }
            });

            it('deve retornar erro quando o campo passwordConfirmation não for igual ao campo password', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'passworD@1546',
                    passwordConfirmation: 'passworD@1548',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('As senhas não coincidem');
                }
            });
        });

        describe('[property]: departments', () => {
            it('deve retornar erro se o departments não for um array de string', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'passworD@1546',
                    passwordConfirmation: 'passworD@1548',
                    departments: '',
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
            });

            it('deve retornar erro se o departments não for um array com uuid válido', () => {
                const payload = {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    password: 'passworD@1546',
                    passwordConfirmation: 'passworD@1548',
                    departments: ['123'],
                };

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O ID dos departamentos não são UUIDs válidos.');
                }
            });
        });
    });

    describe('[schema]: confirmEmailSchema', () => {
        describe('[property]: token', () => {
            it('deve retornar erro quando o campo token não for enviado', () => {
                const result = confirmEmailSchema.safeParse({});

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O campo token é obrigatório.');
                }
            });

            it('deve retornar erro quando o campo token não for de um formato válido', () => {
                const payload = {
                    token: '78954',
                };

                const result = confirmEmailSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Token com formato inválido');
                }
            });
        });
    });

    describe('[schema]: resendConfirmationEmailSchema', () => {
        describe('[property]: email', () => {
            it('deve retornar erro quando o campo email não for de um formato válido', () => {
                const payload = {
                    email: '78954.com',
                };

                const result = resendConfirmationEmailSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
                }
            });
        });
    });
});
