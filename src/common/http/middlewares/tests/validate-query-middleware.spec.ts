import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { validateQueryMiddleware } from '../validate-query-middleware';

describe('[UNIT TEST]: Middleware - Validate Query', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: NextFunction;

    const testSchema = z.object({
        page: z.coerce.number().default(1),
        search: z.string().optional(),
    });

    beforeEach(() => {
        mockReq = { query: {} };
        mockRes = {};
        nextFunction = vi.fn();
    });

    it('deve validar a query, atribuir os valores default e manter a MESMA referência de memória do objeto (getter bypass)', async () => {
        mockReq.query = { search: 'teste' };

        // Salvamos a referência original do objeto na memória
        const originalQueryRef = mockReq.query;

        const middleware = validateQueryMiddleware(testSchema);
        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockReq.query).toEqual({ page: 1, search: 'teste' });
        // 🛡️ Garante que a referência do objeto não mudou, apenas as chaves internas (vital pro Express)
        expect(mockReq.query).toBe(originalQueryRef);
        expect(nextFunction).toHaveBeenCalledOnce();
    });

    it('deve remover propriedades injetadas maliciosamente (stripping)', async () => {
        mockReq.query = { page: '2', malicious_injection: 'DROP TABLE users' };
        const middleware = validateQueryMiddleware(testSchema);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        // Removeu o campo malicioso e fez a coerção da página para Number
        expect(mockReq.query).toEqual({ page: 2 });
        expect(nextFunction).toHaveBeenCalledOnce();
    });

    it('deve repassar o ZodError para o next(error) em caso de falha de validação', async () => {
        mockReq.query = { page: 'not-a-number' }; // Vai falhar na coerção matemática
        const middleware = validateQueryMiddleware(testSchema);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledOnce();
        expect(vi.mocked(nextFunction).mock.calls[0][0]).toBeInstanceOf(ZodError);
    });
});
