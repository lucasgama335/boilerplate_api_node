import { Request, Response } from 'express';
import { UserService } from './users.services';

export class UsersController {
    constructor(private readonly userService: UserService) {}

    registerUser = async (req: Request, res: Response): Promise<Response> => {
        const data = req.body;

        const user = await this.userService.registerUser(data);

        return res.status(201).json(user);
    };

    showProfile = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;

        const user = await this.userService.getProfile(userId);

        return res.status(200).json(user);
    };
}
