import { Request, Response } from 'express';
import { UserService } from './users.service';

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

    show = async (req: Request, res: Response): Promise<Response> => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        const user = await this.userService.getProfile(id);

        return res.status(200).json(user);
    };

    confirmEmail = async (req: Request, res: Response): Promise<Response> => {
        const { token } = req.body;

        await this.userService.confirmEmail(token);

        return res.status(200).json({ message: 'E-mail confirmado com sucesso.' });
    };

    resendConfirmationEmail = async (req: Request, res: Response): Promise<Response> => {
        const { email } = req.body;

        await this.userService.resendConfirmEmail(email);

        return res.status(200).json({ message: 'Um novo e-mail de confirmação foi enviado para o endereço informado.' });
    };
}
