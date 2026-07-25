import { describe, expect, it } from 'vitest';
import { confirmEmailSchema, registerUserSchema, resendConfirmationEmailSchema } from '../users.schema';

describe('User Schemas (Zod)', () => {
    describe('registerUserSchema', () => {
        it('deve validar com sucesso e transformar/formatar os dados de entrada corretamente', () => {
            const validData = {
                firstName: '  alice  ',
                lastName: 'smith',
                email: ' ALICE.SMITH@EXAMPLE.COM ',
                password: 'StrongPassword!123',
                passwordConfirmation: 'StrongPassword!123',
            };

            const result = registerUserSchema.safeParse(validData);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.firstName).toBe('Alice');
                expect(result.data.lastName).toBe('Smith');
                expect(result.data.email).toBe('alice.smith@example.com');
            }
        });

        it('deve falhar se o nome ou sobrenome tiver menos de 2 caracteres', () => {
            const invalidData = {
                firstName: 'A',
                lastName: 'B',
                email: 'alice@example.com',
                password: 'StrongPassword!123',
                passwordConfirmation: 'StrongPassword!123',
            };

            const result = registerUserSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
            if (!result.success) {
                const errorFields = result.error.issues.map((issue) => issue.path[0]);
                expect(errorFields).toContain('firstName');
                expect(errorFields).toContain('lastName');
            }
        });

        it('deve falhar se o e-mail informado for inválido', () => {
            const result = registerUserSchema.safeParse({
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'email-invalido',
                password: 'StrongPassword!123',
                passwordConfirmation: 'StrongPassword!123',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain('email');
            }
        });

        it('deve falhar se as senhas não coincidirem', () => {
            const data = {
                firstName: 'Alice',
                lastName: 'Smith',
                email: 'alice@example.com',
                password: 'StrongPassword!123',
                passwordConfirmation: 'DifferentPassword!123',
            };

            const result = registerUserSchema.safeParse(data);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain('passwordConfirmation');
                expect(result.error.issues[0].message).toBe('As senhas não coincidem');
            }
        });

        it('deve rejeitar senhas fracas', () => {
            const weakPasswords = ['short!A', 'alllowercase!123', 'NoSpecialChar123'];

            weakPasswords.forEach((password) => {
                const result = registerUserSchema.safeParse({
                    firstName: 'Alice',
                    lastName: 'Smith',
                    email: 'alice@example.com',
                    password: password,
                    passwordConfirmation: password,
                });

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].path).toContain('password');
                }
            });
        });
    });

    describe('confirmEmailSchema', () => {
        it('deve validar com sucesso um token no formato JWT', () => {
            const result = confirmEmailSchema.safeParse({ token: 'header.payload.signature' });
            expect(result.success).toBe(true);
        });

        it('deve falhar se o token não tiver o formato JWT', () => {
            const result = confirmEmailSchema.safeParse({ token: 'token_invalido_sem_pontos' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Token com formato inválido');
            }
        });
    });

    describe('resendConfirmationEmailSchema', () => {
        it('deve validar e formatar um e-mail válido', () => {
            const result = resendConfirmationEmailSchema.safeParse({ email: ' USER@EXAMPLE.COM ' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('user@example.com');
            }
        });

        it('deve falhar se o e-mail for inválido', () => {
            const result = resendConfirmationEmailSchema.safeParse({ email: 'invalido' });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
            }
        });
    });
});
