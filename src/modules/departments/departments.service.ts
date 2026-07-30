import { AppError } from '@/common/exceptions/AppError';
import { IUserPermissionsProvider } from '@/modules/user-access/providers/user-access.provider';
import { IDepartmentsRepository } from './repositories/departments.repository';
import { CreateDepartmentDTO, DepartmentsFilters, DepartmentWithPermissions, UpdateDepartmentDTO } from './types/departments.types';

export class DepartmentsService {
    constructor(
        private readonly departmentsRepository: IDepartmentsRepository,
        private readonly userPermissionsProvider: IUserPermissionsProvider,
    ) {}

    async list<T extends boolean>(page: number, limit: number, withPermissions?: T, filters?: DepartmentsFilters) {
        // O TypeScript sabe exatamente se departments será Department[] ou DepartmentWithPermissions[]
        const { departments, total } = await this.departmentsRepository.findMany(page, limit, withPermissions, filters);

        const totalPages = Math.ceil(total / limit) || 1;

        return {
            departments,
            meta: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    }

    async show(id: string): Promise<DepartmentWithPermissions> {
        const permission = await this.departmentsRepository.findById(id, true);
        if (!permission) {
            throw new AppError('Departamento não encontrado em nossa base de dados.', 404);
        }

        return permission;
    }

    async create(data: CreateDepartmentDTO): Promise<DepartmentWithPermissions> {
        const department = await this.departmentsRepository.findByName(data.name);
        if (department) {
            throw new AppError('Já existe um departamento vinculado a esse nome.', 409);
        }

        // 🛡️ Valida se todas as permissões informadas realmente existem no banco
        if (data.permissions && data.permissions.length > 0) {
            const permissionsExist = await this.departmentsRepository.checkPermissionsExist(data.permissions);
            if (!permissionsExist) {
                throw new AppError('Um ou mais IDs de permissão informados são inválidos ou não existem.', 400);
            }
        }

        const createdDepartment = await this.departmentsRepository.create(data);
        if (!createdDepartment) {
            throw new AppError('Ocorreu algum problema durante a criação do departamento.', 500);
        }

        return createdDepartment;
    }

    async update(id: string, data: UpdateDepartmentDTO): Promise<DepartmentWithPermissions> {
        if (Object.keys(data).length === 0) {
            throw new AppError('Nenhum campo foi enviado para atualização.', 400);
        }

        const department = await this.departmentsRepository.findById(id, true);
        if (!department) {
            throw new AppError('Departamento não encontrado em nossa base de dados.', 404);
        }

        const hasBasicDataChanges = Object.entries(data).some(([key, value]) => {
            if (key === 'permissions') return false;
            return department[key as keyof typeof department] !== value;
        });

        let hasPermissionChanges = false;
        if (data.permissions) {
            // 🛡️ Valida se as permissões enviadas existem antes de processar a comparação
            if (data.permissions.length > 0) {
                const permissionsExist = await this.departmentsRepository.checkPermissionsExist(data.permissions);
                if (!permissionsExist) {
                    throw new AppError('Um ou mais IDs de permissão informados são inválidos ou não existem.', 400);
                }
            }

            const currentPermissionIds = department.permissions?.map((p) => p.id) || [];
            const incomingIds = [...data.permissions].sort();
            const existingIds = [...currentPermissionIds].sort();

            hasPermissionChanges = JSON.stringify(incomingIds) !== JSON.stringify(existingIds);
        }

        if (!hasBasicDataChanges && !hasPermissionChanges) {
            return department;
        }

        if (data.name && data.name !== department.name) {
            const nameExists = await this.departmentsRepository.findByName(data.name);
            if (nameExists) {
                throw new AppError('Já existe outro departamento vinculado a esse nome.', 409);
            }
        }

        const updatedDepartment = await this.departmentsRepository.update(id, data);
        if (hasPermissionChanges) {
            await this.userPermissionsProvider.invalidatePermissionsByDepartment(id);
        }

        if (!updatedDepartment) {
            throw new AppError('Ocorreu algum problema durante a atualização do departamento.', 500);
        }

        return updatedDepartment;
    }

    async delete(id: string): Promise<void> {
        const permission = await this.departmentsRepository.findById(id);
        if (!permission) {
            throw new AppError('Departamento não encontrado em nossa base de dados.', 404);
        }

        const affectedUserIds = await this.userPermissionsProvider.getAffectedUserIdsByDepartment(id);
        await this.departmentsRepository.delete(id);
        await this.userPermissionsProvider.invalidatePermissionsForUsers(affectedUserIds);
    }
}
