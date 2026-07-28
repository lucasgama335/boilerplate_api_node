import { describe, expect, it } from 'vitest';
import {
    authenticateUserSchema,
    changePasswordUserSchema,
    forgotPasswordSchema,
    logoutAllDevicesSchema,
    refreshTokenSchema,
    resetPasswordSchema,
} from '../schemas/authentication.schemas';

describe('[UNIT TEST]: Módulo de Autenticação - Schemas', () => {
    describe('[schema]: authenticateUserSchema', () => {
        it('deve formatar o e-mail (trim e lowercase) e validar dados corretos', () => {
            const payload = {
                email: '   JOHN.DOE@EXAMPLE.COM   ',
                password: 'password123',
            };

            const result = authenticateUserSchema.safeParse(payload);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('john.doe@example.com');
            }
        });

        it('deve retornar erro se o e-mail for inválido', () => {
            const payload = { email: 'invalid-email', password: '123' };
            const result = authenticateUserSchema.safeParse(payload);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
            }
        });

        it('deve retornar erro se a senha estiver vazia', () => {
            const payload = { email: 'test@example.com', password: '' };
            const result = authenticateUserSchema.safeParse(payload);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('A senha é obrigatória');
            }
        });
    });

    describe('[schema]: forgotPasswordSchema', () => {
        it('deve retornar erro se o formato do e-mail for inválido', () => {
            const result = forgotPasswordSchema.safeParse({ email: 'ghost.com' });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Formato de e-mail inválido');
            }
        });

        it('deve ser válido e formatar o e-mail corretamente', () => {
            const result = forgotPasswordSchema.safeParse({ email: '  TEST@EXAMPLE.COM ' });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.email).toBe('test@example.com');
            }
        });
    });

    describe('[schema]: refreshTokenSchema', () => {
        it('deve retornar a mensagem de erro customizada caso o token não seja informado', () => {
            const result = refreshTokenSchema.safeParse({});

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('O refresh token é obrigatório.');
            }
        });
    });

    describe('[schema]: resetPasswordSchema', () => {
        const validPayload = {
            resetPasswordToken: 'header.payload.signature',
            password: 'NewPassword@123',
            passwordConfirmation: 'NewPassword@123',
        };

        it('deve retornar erro se o token não tiver formato de JWT válido', () => {
            const result = resetPasswordSchema.safeParse({ ...validPayload, resetPasswordToken: 'token invalido com espacos' });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Token com formato inválido');
            }
        });

        it('deve retornar erro se a senha não atender aos requisitos (mínimo, maiúscula, especial)', () => {
            // Sem especial e sem maiúscula
            const result = resetPasswordSchema.safeParse({ ...validPayload, password: 'password123', passwordConfirmation: 'password123' });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('A senha deve conter pelo menos uma letra maiúscula'); // Bate na primeira regex que falhar
            }
        });

        it('deve retornar erro se as senhas não coincidirem (refine validation)', () => {
            const result = resetPasswordSchema.safeParse({ ...validPayload, passwordConfirmation: 'DifferentPass@123' });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('As senhas não coincidem');
                expect(result.error.issues[0].path[0]).toBe('passwordConfirmation');
            }
        });

        it('deve passar se todos os requisitos forem atendidos', () => {
            const result = resetPasswordSchema.safeParse(validPayload);
            expect(result.success).toBe(true);
        });
    });

    describe('[schema]: changePasswordUserSchema', () => {
        const validPayload = {
            oldPassword: 'OldPassword@123',
            newPassword: 'NewPassword@123',
            passwordConfirmation: 'NewPassword@123',
        };

        it('deve retornar erro se a nova senha e a confirmação não coincidirem', () => {
            const result = changePasswordUserSchema.safeParse({ ...validPayload, passwordConfirmation: 'Oops@123' });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('As senhas não coincidem');
            }
        });

        it('deve retornar erro se a nova senha for igual à senha atual', () => {
            const result = changePasswordUserSchema.safeParse({
                oldPassword: 'SamePassword@123',
                newPassword: 'SamePassword@123',
                passwordConfirmation: 'SamePassword@123',
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('A nova senha não pode ser igual à senha atual');
                expect(result.error.issues[0].path[0]).toBe('newPassword');
            }
        });

        it('deve passar quando as senhas antigas e novas forem diferentes, e a confirmação bater', () => {
            const result = changePasswordUserSchema.safeParse(validPayload);
            expect(result.success).toBe(true);
        });
    });

    describe('[schema]: logoutAllDevicesSchema', () => {
        it('deve assumir keepCurrentSession como false quando não informado (default value)', () => {
            const result = logoutAllDevicesSchema.safeParse({});

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.keepCurrentSession).toBe(false);
            }
        });

        it('deve aceitar true ou false corretamente', () => {
            const result = logoutAllDevicesSchema.safeParse({ keepCurrentSession: true });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.keepCurrentSession).toBe(true);
            }
        });

        it('deve rejeitar se for passado um tipo diferente de boolean', () => {
            const result = logoutAllDevicesSchema.safeParse({ keepCurrentSession: 'true' });

            expect(result.success).toBe(false);
        });
    });
});
