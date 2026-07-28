import { describe, expect, it } from 'vitest';
import { confirmEmailSchema, registerUserSchema, resendConfirmationEmailSchema } from '../schemas/users.schemas';
import { makeCreateUserDTO } from './factories/users.factory';

describe('[UNIT TEST]: Módulo de Usuários - Schemas', () => {
    describe('[schema]: registerUserSchema', () => {
        describe('[property]: firstName', () => {
            it('deve retornar erro quando o campo firstName tiver menos de 2 caracteres', () => {
                const payload = makeCreateUserDTO({ firstName: 'A' });

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O nome deve ter no mínimo 2 caracteres');
                }
            });
        });

        describe('[property]: lastName', () => {
            it('deve retornar erro quando o campo lastName tiver menos de 2 caracteres', () => {
                const payload = makeCreateUserDTO({ lastName: 'A' });

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O sobrenome deve ter no mínimo 2 caracteres');
                }
            });
        });

        describe('[property]: email', () => {
            it('deve retornar erro quando o campo email não for um email válido', () => {
                const payload = makeCreateUserDTO({ email: 'ghost.com' });

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
                }
            });
        });

        describe('[property]: password', () => {
            it('deve retornar erro quando o campo password tiver menos de 8 caracteres', () => {
                const payload = makeCreateUserDTO({ password: 'A' });

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('A senha deve ter no mínimo 8 caracteres');
                }
            });

            it('deve retornar erro quando o campo password não tiver nenhuma letra maiúscula', () => {
                const payload = makeCreateUserDTO({ password: 'abcdefgh@' });

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('A senha deve conter pelo menos uma letra maiúscula');
                }
            });

            it('deve retornar erro quando o campo password não tiver nenhum caractere especial', () => {
                const payload = makeCreateUserDTO({ password: 'Abcdefgh' });

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('A senha deve conter pelo menos um caractere especial');
                }
            });
        });

        describe('[property]: passwordConfirmation', () => {
            it('deve retornar erro quando o campo passwordConfirmation não estiver presente', () => {
                const originalPayload = makeCreateUserDTO();
                const { passwordConfirmation: _, ...payload } = originalPayload;

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('O campo de confirmação de senha é obrigatório, mas não foi encontrado');
                }
            });

            it('deve retornar erro quando o campo passwordConfirmation não for igual ao campo password', () => {
                const payload = makeCreateUserDTO({ passwordConfirmation: 'Abcdefgh' });

                const result = registerUserSchema.safeParse(payload);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('As senhas não coincidem');
                }
            });
        });

        describe('[property]: departments', () => {
            it('deve retornar erro se o departments não for um array com uuid válido', () => {
                const payload = makeCreateUserDTO({ departments: ['Abcdefgh'] });

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
                const result = confirmEmailSchema.safeParse({ token: '78954' });

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
                const result = resendConfirmationEmailSchema.safeParse({ email: '78954.com' });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
                }
            });
        });
    });
});
