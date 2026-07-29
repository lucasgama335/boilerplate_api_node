import { createPaginationSchema } from '@/common/schemas/common.schemas';
import z from 'zod';

export const departmentsCreateSchema = z.object({
    name: z
        .string({ message: 'O nome do departamento é obrigatório.' })
        .trim()
        .min(2, 'O nome do departamento deve ter no mínimo 2 caracteres.')
        .max(100, 'O nome do departamento deve ter no máximo 100 caracteres.')
        .nonoptional(),

    description: z.string().trim().max(500, 'A descrição deve ter no máximo 500 caracteres.').optional().nullable(),

    permissions: z.array(z.uuid('Cada ID de permissão deve ser um UUID válido.')).optional(),
});

export const departmentsUpdateSchema = z.object({
    name: z
        .string({ message: 'O nome do departamento é obrigatório.' })
        .trim()
        .min(2, 'O nome do departamento deve ter no mínimo 2 caracteres.')
        .max(100, 'O nome do departamento deve ter no máximo 100 caracteres.')
        .optional(),

    description: z.string().trim().max(500, 'A descrição deve ter no máximo 500 caracteres.').optional().nullable(),

    permissions: z.array(z.uuid('Cada ID de permissão deve ser um UUID válido.')).optional(),
});

export const departmentsListQuerySchema = createPaginationSchema().extend({
    name: z.string().trim().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});
export type DepartmentsListQuery = z.infer<typeof departmentsListQuerySchema>;
