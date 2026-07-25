import z from 'zod';

export const registerUserSchema = z
    .object({
        firstName: z
            .string()
            .trim()
            .min(2, 'O nome deve ter no mínimo 2 caracteres')
            .transform((val) => val.charAt(0).toUpperCase() + val.slice(1)),
        lastName: z
            .string()
            .trim()
            .min(2, 'O sobrenome deve ter no mínimo 2 caracteres')
            .transform((val) => val.charAt(0).toUpperCase() + val.slice(1)),

        email: z.string().trim().toLowerCase().email('Formato de e-mail inválido'),

        password: z
            .string()
            .min(8, 'A senha deve ter no mínimo 8 caracteres')
            .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
            .regex(/[!@#$%^&*(),.?":{}|<>]/, 'A senha deve conter pelo menos um caractere especial'),

        passwordConfirmation: z.string({
            error: 'O campo de confirmação de senha é obrigatório, mas não foi encontrado',
        }),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
        message: 'As senhas não coincidem',
        path: ['passwordConfirmation'],
    });

export type RegisterUserDTO = z.infer<typeof registerUserSchema>;
