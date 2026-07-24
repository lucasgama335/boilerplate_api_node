import { Request, Response } from 'express';
import { UserService } from './users.services';

export class ProfileController {
    constructor(private readonly userService: UserService) {}

    showProfile = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;

        const user = await this.userService.getProfile(userId);

        return res.status(200).json(user);
    };
}
