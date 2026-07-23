import { Request, Response } from 'express';
import { GetUserProfileService } from '../../application/GetUserProfileService';

export class ProfileController {
    constructor(private readonly getUserProfileService: GetUserProfileService) {}

    showProfile = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;

        const user = await this.getUserProfileService.execute(userId);

        return res.status(200).json(user);
    };
}
