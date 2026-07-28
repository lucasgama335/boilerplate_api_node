import { Request, Response } from 'express';
import { PermissionsService } from './permissions.service';
import { PermissionsListQuery } from './schemas/permissions.schemas';

export class PermissionsController {
    constructor(private readonly permissionsService: PermissionsService) {}

    list = async (req: Request, res: Response): Promise<Response> => {
        const { page, limit, code, startDate, endDate } = req.query as unknown as PermissionsListQuery;
        const filters = { code, startDate, endDate };

        const permissions = await this.permissionsService.list(page, limit, filters);

        return res.status(200).json(permissions);
    };

    show = async (req: Request, res: Response): Promise<Response> => {
        const { id } = req.params as { id: string };

        const permission = await this.permissionsService.show(id);

        return res.status(200).json({ permission });
    };

    create = async (req: Request, res: Response): Promise<Response> => {
        const data = req.body;

        const permission = await this.permissionsService.create(data);

        return res.status(201).json({ permission });
    };

    update = async (req: Request, res: Response): Promise<Response> => {
        const { id } = req.params as { id: string };
        const data = req.body;

        const permission = await this.permissionsService.update(id, data);

        return res.status(200).json({ permission });
    };

    delete = async (req: Request, res: Response): Promise<Response> => {
        const { id } = req.params as { id: string };

        await this.permissionsService.delete(id);

        return res.status(200).json({});
    };
}
