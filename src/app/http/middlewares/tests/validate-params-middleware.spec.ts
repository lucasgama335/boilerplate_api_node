import { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { validateParamsMiddleware } from '../validate-params-middleware';

describe('[UNIT TEST]: Middleware - Validate Params', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let nextFunction: NextFunction;

    const testSchema = z.object({
        id: z.string().uuid(),
    });

    beforeEach(() => {
        mockReq = { params: {} };
        mockRes = {};
        nextFunction = vi.fn();
    });

    it('deve validar os parâmetros e chamar next() em caso de sucesso', async () => {
        const validUUID = crypto.randomUUID();
        mockReq.params = { id: validUUID };
        const middleware = validateParamsMiddleware(testSchema);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(mockReq.params).toEqual({ id: validUUID });
        expect(nextFunction).toHaveBeenCalledOnce();
        expect(nextFunction).toHaveBeenCalledWith();
    });

    it('deve repassar o ZodError para o next(error) em caso de falha de validação', async () => {
        mockReq.params = { id: 'invalid-id-format' };
        const middleware = validateParamsMiddleware(testSchema);

        await middleware(mockReq as Request, mockRes as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledOnce();
        expect(vi.mocked(nextFunction).mock.calls[0][0]).toBeInstanceOf(ZodError);
    });
});
