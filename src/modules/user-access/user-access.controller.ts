import { NextFunction, Request, Response } from 'express';
import { UserAccessService } from './user-access.service';

export class UserAccessController {
    constructor(private readonly userAccessService: UserAccessService) {}

    create = async (req: Request, res: Response, _next: NextFunction): Promise<Response> => {
        const { id } = req.params as { id: string };
        const grantedById = req.user.id;
        const { permissions } = req.body;

        const user = await this.userAccessService.setUserPermissions(id, permissions, grantedById);

        return res.status(201).json({ user });
    };

    deny = async (req: Request, res: Response, _next: NextFunction): Promise<Response> => {
        const { id } = req.params as { id: string };
        const deniedById = req.user.id;
        const { permissions } = req.body;

        const user = await this.userAccessService.setUserDeniedPermissions(id, permissions, deniedById);

        return res.status(201).json({ user });
    };
}
