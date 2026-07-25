import { describe, expect, it } from 'vitest';
import { authenticateUserSchema, changePasswordUserSchema, forgotPasswordSchema, refreshTokenSchema, resetPasswordSchema } from '../authentication.schemas';

describe('Authentication Schemas (Zod)', () => {
    describe('forgotPasswordSchema', () => {
        it('deve aceitar um e-mail válido e formatá-lo (trim e lowercase)', () => {
            const result = forgotPasswordSchema.safeParse({ email: ' USER@EXAMPLE.COM ' });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('user@example.com');
            }
        });

        it('deve falhar se o e-mail for inválido', () => {
            const result = forgotPasswordSchema.safeParse({ email: 'invalido' });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
            }
        });
    });

    describe('resetPasswordSchema', () => {
        it('deve validar com sucesso um token no formato JWT e senhas válidas', () => {
            const validData = {
                resetPasswordToken: 'header.payload.signature',
                password: 'NewPassword!123',
                passwordConfirmation: 'NewPassword!123',
            };

            const result = resetPasswordSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('deve falhar se o token não tiver o formato de JWT', () => {
            const result = resetPasswordSchema.safeParse({
                resetPasswordToken: 'token_invalido_sem_pontos',
                password: 'NewPassword!123',
                passwordConfirmation: 'NewPassword!123',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Token com formato inválido');
            }
        });

        it('deve falhar se a confirmação de senha não bater', () => {
            const result = resetPasswordSchema.safeParse({
                resetPasswordToken: 'header.payload.signature',
                password: 'NewPassword!123',
                passwordConfirmation: 'DifferentPassword!123',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain('passwordConfirmation');
                expect(result.error.issues[0].message).toBe('As senhas não coincidem');
            }
        });
    });

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
    });

    describe('authenticateUserSchema', () => {
        it('deve aceitar credenciais válidas e formatar o email', () => {
            const result = authenticateUserSchema.safeParse({
                email: ' ADMIN@DOMAIN.COM ',
                password: 'my-password',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('admin@domain.com');
            }
        });
    });

    describe('refreshTokenSchema', () => {
        it('deve validar um payload contendo o refreshToken', () => {
            const result = refreshTokenSchema.safeParse({ refreshToken: 'any-valid-token-string' });
            expect(result.success).toBe(true);
        });
    });
});
