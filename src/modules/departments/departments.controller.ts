import { Request, Response } from 'express';
import { DepartmentsService } from './departments.service';

export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) {}

    list = async (req: Request, res: Response): Promise<Response> => {
        const page = Number(req.query.page);
        const limit = Number(req.query.limit);

        // const withPermissions = req.query.withPermissions; (Futuramente se precisar podemos deixar a decisão de listar com as permissões para o frontend)

        const permissions = await this.departmentsService.list(page, limit);

        return res.status(200).json(permissions);
    };

    show = async (req: Request, res: Response): Promise<Response> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const department = await this.departmentsService.show(id);

        return res.status(200).json({ department });
    };

    create = async (req: Request, res: Response): Promise<Response> => {
        const data = { ...req.body, createdById: req.user.id };

        const department = await this.departmentsService.create(data);

        return res.status(201).json({ department });
    };

    update = async (req: Request, res: Response): Promise<Response> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const data = { ...req.body, updatedById: req.user.id };

        const department = await this.departmentsService.update(id, data);

        return res.status(200).json({ department });
    };

    delete = async (req: Request, res: Response): Promise<Response> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const department = await this.departmentsService.delete(id);

        return res.status(200).json({ department });
    };
}
