import { createPaginationSchema } from '@/common/schemas/common.schemas';
import z from 'zod';
import { PERMISSION_CODES } from '../constants/permission-codes';

export const permissionsCreateSchema = z.object({
    code: z.enum(PERMISSION_CODES, 'Código de permissão desconhecido.').nonoptional(),
    description: z.string({ error: 'O campo description é obrigatório.' }).min(5, 'O campo description deve ao menos ter 5 caracteres').nonoptional(),
});

export const permissionsUpdateSchema = z.object({
    code: z
        .string({ message: 'O código é obrigatório' })
        .trim()
        .toLowerCase() // Garante que tudo fique em minúsculas (ex: USERS:CREATE vira users:create)
        .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, 'Formato inválido. O código deve seguir o padrão recurso:ação (ex: users:create)')
        .optional(),
    description: z.string({ error: 'O campo description é obrigatório.' }).min(5, 'O campo description deve ao menos ter 5 caracteres').optional(),
});

export const permissionsListQuerySchema = createPaginationSchema().extend({
    code: z.string().trim().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});
export type PermissionsListQuery = z.infer<typeof permissionsListQuerySchema>;
