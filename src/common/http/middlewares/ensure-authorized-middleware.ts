import { AppError } from '@/common/exceptions/AppError';
import { IUserPermissionsProvider } from '@/modules/user-access/providers/user-access.provider';
import { NextFunction, Request, Response } from 'express';

export function ensureAuthorizedMiddleware(permissionsProvider: IUserPermissionsProvider, requiredPermissions: string[]) {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const userId = req.user?.id;

        // Fallback de segurança caso o desenvolvedor esqueça de colocar
        // o authMiddleware antes deste middleware na rota.
        if (!userId) {
            throw new AppError('Usuário não autenticado.', 401);
        }

        // Se a rota não exige nenhuma permissão, passa direto
        if (requiredPermissions.length === 0) {
            return next();
        }

        // 1. Busca as permissões em 1ms no Redis (ou no banco se der Cache Miss)
        const userPermissions = await permissionsProvider.getPermissions(userId);

        // Se o Redis devolveu o curinga, é Super Admin! Passa direto.
        if (userPermissions.includes('*')) {
            return next();
        }

        // 2. Verifica se o usuário tem TODAS as permissões exigidas no Array (Lógica AND)
        const hasAllPermissions = requiredPermissions.every((required) => userPermissions.includes(required));

        if (!hasAllPermissions) {
            throw new AppError('Acesso negado. Você não possui permissão para realizar esta ação.', 403);
        }

        return next();
    };
}
