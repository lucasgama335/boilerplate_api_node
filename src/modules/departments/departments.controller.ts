import { Request, Response } from 'express';
import { DepartmentsService } from './departments.service';
import { DepartmentsListQuery } from './schemas/departments.schemas';

export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) {}

    list = async (req: Request, res: Response): Promise<Response> => {
        const { page, limit, name, startDate, endDate } = req.query as unknown as DepartmentsListQuery;
        const filters = { name, startDate, endDate };

        // const withPermissions = req.query.withPermissions === 'true' ? true : false; // (Futuramente se precisar podemos deixar a decisão de listar com as permissões para o frontend) - Lembrar que precisa refatorar o teste do controller caso implemente isso

        const departments = await this.departmentsService.list(page, limit, undefined, filters);

        return res.status(200).json(departments);
    };

    show = async (req: Request, res: Response): Promise<Response> => {
        const { id } = req.params as { id: string };

        const department = await this.departmentsService.show(id);

        return res.status(200).json({ department });
    };

    create = async (req: Request, res: Response): Promise<Response> => {
        const data = { ...req.body, createdById: req.user.id };

        const department = await this.departmentsService.create(data);

        return res.status(201).json({ department });
    };

    update = async (req: Request, res: Response): Promise<Response> => {
        const { id } = req.params as { id: string };
        const data = { ...req.body, updatedById: req.user.id };

        const department = await this.departmentsService.update(id, data);

        return res.status(200).json({ department });
    };

    delete = async (req: Request, res: Response): Promise<Response> => {
        const { id } = req.params as { id: string };

        const department = await this.departmentsService.delete(id);

        return res.status(200).json({ department });
    };
}
