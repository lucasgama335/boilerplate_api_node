import z from 'zod';

export const setUserPermissionsDTOSchema = z.object({
    permissions: z.array(z.uuid('Cada ID de permissão deve ser um UUID válido.')),
});

export const setUserDeniedPermissionsDTOSchema = z.object({
    permissions: z.array(z.uuid('Cada ID de permissão deve ser um UUID válido.')),
});
