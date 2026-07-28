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

        email: z.string().trim().toLowerCase().pipe(z.email('Formato de e-mail inválido')).nonoptional(),

        password: z
            .string()
            .min(8, 'A senha deve ter no mínimo 8 caracteres')
            .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
            .regex(/[!@#$%^&*(),.?":{}|<>]/, 'A senha deve conter pelo menos um caractere especial'),

        passwordConfirmation: z.string({
            error: 'O campo de confirmação de senha é obrigatório, mas não foi encontrado',
        }),

        departments: z.array(z.uuid('O ID dos departamentos não são UUIDs válidos.')).optional(),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
        message: 'As senhas não coincidem',
        path: ['passwordConfirmation'],
    });

export const confirmEmailSchema = z.object({
    token: z.string('O campo token é obrigatório.').regex(/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/, 'Token com formato inválido'),
});

export const resendConfirmationEmailSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email('Formato de e-mail inválido')).nonoptional(),
});

export type RegisterUserDTO = z.infer<typeof registerUserSchema>;
export type ConfirmEmailDTO = z.infer<typeof confirmEmailSchema>;
