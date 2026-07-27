import z from 'zod';

export const setUserPermissionsDTOSchema = z.object({
    grantedById: z.uuid('O ID informado não é um UUID válido.').optional(),
    permissions: z.array(z.uuid('Cada ID de permissão deve ser um UUID válido.')),
});
