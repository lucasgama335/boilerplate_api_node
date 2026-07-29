import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { validateDataMiddleware } from '../validate-data-middleware';

describe('[UNIT TEST]: Middleware - Validate Data (Body)', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: NextFunction;

    // Criamos um schema genérico apenas para o teste
    const testSchema = z.object({
        name: z.string(),
        age: z.coerce.number(), // Coerção de string para número
    });

    beforeEach(() => {
        mockReq = { body: {} };
        mockRes = {};
        nextFunction = vi.fn();
    });

    it('deve validar, formatar (coerção/stripping) os dados e chamar next() em caso de sucesso', async () => {
        mockReq.body = { name: 'John', age: '25', extra_field: 'ignorar' };
        const middleware = validateDataMiddleware(testSchema);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        // O campo 'extra_field' deve sumir e 'age' virar Number (Ação padrão do Zod)
        expect(mockReq.body).toEqual({ name: 'John', age: 25 });
        expect(nextFunction).toHaveBeenCalledOnce();
        expect(nextFunction).toHaveBeenCalledWith(); // Chamado sem argumentos (sem erro)
    });

    it('deve repassar o ZodError para o next(error) em caso de falha de validação', async () => {
        mockReq.body = { age: 25 }; // Falta o 'name' que é obrigatório
        const middleware = validateDataMiddleware(testSchema);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledOnce();
        // O primeiro argumento da primeira chamada deve ser um erro do Zod
        expect(vi.mocked(nextFunction).mock.calls[0][0]).toBeInstanceOf(ZodError);
    });
});
