import { describe, expect, it } from 'vitest';
import { authenticateUserSchema, changePasswordUserSchema, refreshTokenSchema } from '../authentication.schemas';

describe('Authentication Schemas (Zod)', () => {
    describe('changePasswordUserSchema', () => {
        it('deve validar com sucesso quando as senhas estão corretas e a nova é diferente da antiga', () => {
            const validData = {
                oldPassword: 'OldPassword!123',
                newPassword: 'NewPassword!123',
                passwordConfirmation: 'NewPassword!123',
            };

            const result = changePasswordUserSchema.safeParse(validData);

            expect(result.success).toBe(true);
        });

        it('deve falhar se a nova senha for igual à senha atual', () => {
            const invalidData = {
                oldPassword: 'SamePassword!123',
                newPassword: 'SamePassword!123',
                passwordConfirmation: 'SamePassword!123',
            };

            const result = changePasswordUserSchema.safeParse(invalidData);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain('newPassword');
                expect(result.error.issues[0].message).toBe('A nova senha não pode ser igual à senha atual');
            }
        });

        it('deve falhar se a confirmação de senha não bater com a nova senha', () => {
            const result = changePasswordUserSchema.safeParse({
                oldPassword: 'OldPassword!123',
                newPassword: 'NewPassword!123',
                passwordConfirmation: 'DifferentPassword!123',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain('passwordConfirmation');
                expect(result.error.issues[0].message).toBe('As senhas não coincidem');
            }
        });

        it('deve rejeitar senhas fracas na nova senha', () => {
            const result = changePasswordUserSchema.safeParse({
                oldPassword: 'ValidOldPassword!123',
                newPassword: 'weakpassword',
                passwordConfirmation: 'weakpassword',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain('newPassword');
            }
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
