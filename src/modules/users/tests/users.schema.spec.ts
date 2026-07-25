import { describe, expect, it } from 'vitest';
import { registerUserSchema } from '../users.schema';

describe('User Schemas (Zod)', () => {
    describe('registerUserSchema', () => {
        it('deve validar com sucesso e transformar/formatar os dados de entrada corretamente', () => {
            const validData = {
                firstName: '  alice  ', // Com espaços extras e minúsculo
                lastName: 'smith',
                email: ' ALICE.SMITH@EXAMPLE.COM ', // Com espaços e maiúsculo
                password: 'StrongPassword!123',
                passwordConfirmation: 'StrongPassword!123',
            };

            const result = registerUserSchema.safeParse(validData);

            expect(result.success).toBe(true);
            if (result.success) {
                // Verifica se aplicou as transformações do Zod (Trims, Lowercase e Capitalize)
                expect(result.data.firstName).toBe('Alice');
                expect(result.data.lastName).toBe('Smith');
                expect(result.data.email).toBe('alice.smith@example.com');
            }
        });

        it('deve falhar se o nome ou sobrenome tiver menos de 2 caracteres', () => {
            const invalidData = {
                firstName: 'A', // Inválido (< 2)
                lastName: 'B', // Inválido (< 2)
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
                passwordConfirmation: 'DifferentPassword!123', // Divergente
            };

            const result = registerUserSchema.safeParse(data);

            expect(result.success).toBe(false);
            if (!result.success) {
                // O refine aponta o erro diretamente para o campo de confirmação
                expect(result.error.issues[0].path).toContain('passwordConfirmation');
                expect(result.error.issues[0].message).toBe('As senhas não coincidem');
            }
        });

        it('deve rejeitar senhas fracas (curtas, sem letra maiúscula ou sem caractere especial)', () => {
            const weakPasswords = [
                'short!A', // Menos de 8 caracteres
                'alllowercase!123', // Sem letra maiúscula
                'NoSpecialChar123', // Sem caractere especial
            ];

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
});
