import { AppError } from '@/app/exceptions/AppError';
import { IPermissionsRepository } from './repositories/permissions.repository';
import { CreatePermissionDTO, PaginatedPermissionsResponse, Permission, UpdatePermissionDTO } from './types/permissions.types';

export class PermissionsService {
    constructor(private readonly permissionsRepository: IPermissionsRepository) {}

    async list(page: number, limit: number): Promise<PaginatedPermissionsResponse> {
        const { permissions, total } = await this.permissionsRepository.findMany(page, limit);

        // Calcula o total de páginas (arredondando para cima). Se total for 0, garante pelo menos 1.
        const totalPages = Math.ceil(total / limit) || 1;

        return {
            permissions,
            meta: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    async show(id: string): Promise<Permission> {
        const permission = await this.permissionsRepository.findById(id);
        if (!permission) {
            throw new AppError('Permissão não encontrada em nossa base de dados.', 404);
        }

        return permission;
    }

    async create(data: CreatePermissionDTO): Promise<Permission> {
        const existing = await this.permissionsRepository.findByCodeIncludingInactive(data.code);
        if (existing) {
            throw new AppError('Já existe uma permissão vinculada a esse code.', 409);
        }

        const createdPermission = await this.permissionsRepository.create(data);
        if (!createdPermission) {
            throw new AppError('Ocorreu algum problema durante a criação da permissão.', 500);
        }

        return createdPermission;
    }

    async update(id: string, data: UpdatePermissionDTO): Promise<Permission> {
        if (Object.keys(data).length === 0) {
            throw new AppError('Nenhum campo foi enviado para atualização.', 400);
        }

        const permission = await this.permissionsRepository.findById(id);
        if (!permission) {
            throw new AppError('Permissão não encontrada em nossa base de dados.', 404);
        }

        // 🛡️ Otimização: Verifica se os dados enviados são exatamente iguais aos que já estão no banco
        const hasChanges = Object.entries(data).some(([key, value]) => {
            return permission[key as keyof Permission] !== value;
        });

        // Se nada mudou de fato, retornamos o registro atual direto, sem tocar no banco!
        if (!hasChanges) {
            return permission;
        }

        // Se houver alteração no 'code', valida se já existe duplicado (como você já faz)
        if (data.code && data.code !== permission.code) {
            const codeExists = await this.permissionsRepository.findByCode(data.code);
            if (codeExists) {
                throw new AppError('Já existe outra permissão vinculada a esse code.', 409);
            }
        }

        const updatedPermission = await this.permissionsRepository.update(id, data);
        if (!updatedPermission) {
            throw new AppError('Ocorreu algum problema durante a atualização da permissão.', 500);
        }

        return updatedPermission;
    }

    async delete(id: string): Promise<void> {
        const permission = await this.permissionsRepository.findById(id);
        if (!permission) {
            throw new AppError('Permissão não encontrada em nossa base de dados.', 404);
        }

        await this.permissionsRepository.delete(id);
    }
}
