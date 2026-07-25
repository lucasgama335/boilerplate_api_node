import z from 'zod';

export const authenticateUserSchema = z.object({
    email: z.string().trim().toLowerCase().email('Formato de e-mail inválido'),
    password: z.string().min(1, 'A senha é obrigatória'),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string({
        error: 'O refresh token é obrigatório.',
    }),
});

export const changePasswordUserSchema = z
    .object({
        oldPassword: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
        newPassword: z
            .string()
            .min(8, 'A senha deve ter no mínimo 8 caracteres')
            .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
            .regex(/[!@#$%^&*(),.?":{}|<>]/, 'A senha deve conter pelo menos um caractere especial'),

        passwordConfirmation: z.string({
            error: 'O campo de confirmação de senha é obrigatório, mas não foi encontrado',
        }),
    })
    .refine((data) => data.newPassword === data.passwordConfirmation, {
        message: 'As senhas não coincidem',
        path: ['passwordConfirmation'],
    })
    .refine((data) => data.oldPassword !== data.newPassword, {
        message: 'A nova senha não pode ser igual à senha atual',
        path: ['newPassword'],
    });

// Gerando o tipo TypeScript a partir do Schema
export type AuthenticateUserDTO = z.infer<typeof authenticateUserSchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordUserDTO = z.infer<typeof changePasswordUserSchema>;
