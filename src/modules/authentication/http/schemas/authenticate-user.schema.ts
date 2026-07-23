import z from 'zod';

export const authenticateUserSchema = z.object({
    email: z.string().trim().toLowerCase().email('Formato de e-mail inválido'),
    password: z.string().min(1, 'A senha é obrigatória'),
});

export type AuthenticateUserDTO = z.infer<typeof authenticateUserSchema>;
