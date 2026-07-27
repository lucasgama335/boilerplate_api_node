import { NextFunction, Request, Response } from 'express';
import { UserAccessService } from './user-access.service';

export class UserAccessController {
    constructor(private readonly userAccessService: UserAccessService) {}

    create = async (req: Request, res: Response, _next: NextFunction): Promise<Response> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const grantedById = req.user.id;
        const { permissions } = req.body;

        const user = await this.userAccessService.setUserPermissions(id, permissions, grantedById);

        return res.status(201).json({ user });
    };
}
