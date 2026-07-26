import z from 'zod';

export const idParamSchema = z.object({
    id: z.uuid('O ID informado não é um UUID válido.'),
});

export const createPaginationSchema = (defaultLimit = 20, maxLimit = 100) => {
    return z.object({
        page: z.coerce.number().min(1, 'A página deve ser maior ou igual a 1').default(1),
        limit: z.coerce.number().min(1, 'O limite mínimo por página é 1').max(maxLimit, `O limite máximo por página é ${maxLimit}`).default(defaultLimit),
    });
};
