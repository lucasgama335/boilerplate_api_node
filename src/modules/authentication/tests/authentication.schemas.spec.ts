import { describe, expect, it } from 'vitest';
import { authenticateUserSchema, refreshTokenSchema, registerUserSchema } from '../authentication.schemas';

describe('Authentication Schemas (Zod)', () => {
    describe('registerUserSchema', () => {
        it('deve validar com sucesso e transformar/formatar os dados de entrada corretamente', () => {
            const validData = {
                firstName: '  john  ', // Com espaços sobrando e minúsculo
                lastName: 'doe',
                email: ' JOHN.DOE@EXAMPLE.COM ', // Com espaços e maiúsculo
                password: 'StrongPassword!123',
                passwordConfirmation: 'StrongPassword!123',
            };

            const result = registerUserSchema.safeParse(validData);

            expect(result.success).toBe(true);
            if (result.success) {
                // Verifica as transformações (Trims, Lowercase e Capitalize)
                expect(result.data.firstName).toBe('John');
                expect(result.data.lastName).toBe('Doe');
                expect(result.data.email).toBe('john.doe@example.com');
            }
        });

        it('deve falhar se o nome ou sobrenome tiver menos de 2 caracteres', () => {
            const invalidData = {
                firstName: 'A', // Inválido
                lastName: 'B', // Inválido
                email: 'test@example.com',
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

        it('deve falhar se as senhas não coincidirem', () => {
            const data = {
                firstName: 'John',
                lastName: 'Doe',
                email: 'test@example.com',
                password: 'StrongPassword!123',
                passwordConfirmation: 'DifferentPassword!123', // Diferente
            };

            const result = registerUserSchema.safeParse(data);

            expect(result.success).toBe(false);
            if (!result.success) {
                // O schema possui um .refine que aponta o erro para o campo passwordConfirmation
                expect(result.error.issues[0].path).toContain('passwordConfirmation');
                expect(result.error.issues[0].message).toBe('As senhas não coincidem');
            }
        });

        it('deve rejeitar senhas fracas (sem maiúscula, sem caracter especial ou curtas)', () => {
            const weakPasswords = [
                'short!A', // menos de 8 caracteres
                'alllowercase!123', // sem maiúscula
                'NoSpecialChar123', // sem especial
            ];

            weakPasswords.forEach((password) => {
                const result = registerUserSchema.safeParse({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
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

    describe('authenticateUserSchema', () => {
        it('deve aceitar credenciais válidas e formatar o email', () => {
            const result = authenticateUserSchema.safeParse({
                email: ' ADMIN@DOMAIN.COM ',
                password: 'my-password',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('admin@domain.com'); // Trim e lowercase
            }
        });

        it('deve falhar se o email for inválido', () => {
            const result = authenticateUserSchema.safeParse({
                email: 'not-an-email',
                password: 'my-password',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
            }
        });

        it('deve falhar se a senha for vazia', () => {
            const result = authenticateUserSchema.safeParse({
                email: 'admin@domain.com',
                password: '',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('A senha é obrigatória');
            }
        });
    });

    describe('refreshTokenSchema', () => {
        it('deve validar um payload contendo o refreshToken', () => {
            const result = refreshTokenSchema.safeParse({
                refreshToken: 'any-valid-token-string',
            });

            expect(result.success).toBe(true);
        });

        it('deve falhar e retornar a mensagem customizada caso não seja enviado', () => {
            const result = refreshTokenSchema.safeParse({});

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('O refresh token é obrigatório.');
            }
        });
    });
});
