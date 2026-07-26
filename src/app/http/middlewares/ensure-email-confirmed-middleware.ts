import { AppError } from '@/app/exceptions/AppError';
import { IUsersRepository } from '@/modules/users/repositories/users.repository';
import { NextFunction, Request, Response } from 'express';

export function ensureEmailConfirmedMiddleware(userRepository: IUsersRepository) {
    return async (req: Request, _res: Response, next: NextFunction) => {
        const userId = req.user?.id;

        if (!userId) {
            throw new AppError('Token JWT não informado ou inválido.', 401);
        }

        // Busca o usuário no banco para verificar o status atual de confirmação
        const user = await userRepository.findById(userId);

        if (!user) {
            throw new AppError('Usuário não encontrado.', 404);
        }

        if (!user.isEmailConfirmed) {
            throw new AppError('Acesso negado. Por favor, confirme seu e-mail para realizar esta ação.', 403);
        }

        return next();
    };
}
