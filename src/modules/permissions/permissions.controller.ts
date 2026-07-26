import { Request, Response } from 'express';
import { PermissionsService } from './permissions.service';

export class PermissionsController {
    constructor(private readonly permissionsService: PermissionsService) {}

    list = async (req: Request, res: Response): Promise<Response> => {
        const page = Number(req.query.page);
        const limit = Number(req.query.limit);

        const permissions = await this.permissionsService.list(page, limit);

        return res.status(200).json(permissions);
    };

    show = async (req: Request, res: Response): Promise<Response> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const permission = await this.permissionsService.show(id);

        return res.status(200).json({ permission });
    };

    create = async (req: Request, res: Response): Promise<Response> => {
        const data = req.body;

        const permission = await this.permissionsService.create(data);

        return res.status(201).json({ permission });
    };

    update = async (req: Request, res: Response): Promise<Response> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const data = req.body;

        const permission = await this.permissionsService.update(id, data);

        return res.status(200).json({ permission });
    };

    delete = async (req: Request, res: Response): Promise<Response> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const permission = await this.permissionsService.delete(id);

        return res.status(200).json({ permission });
    };
}
