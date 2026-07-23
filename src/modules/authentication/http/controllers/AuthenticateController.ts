import { Request, Response } from 'express';
import { AuthenticateUserService } from '../../application/AuthenticateUserService';

export class AuthenticateController {
    // 1. A Injeção de Dependência entra aqui no Construtor!
    constructor(private readonly authenticateService: AuthenticateUserService) {}

    // Usamos Arrow Function para não perder o escopo do 'this' no Express
    registerUser = async (req: Request, res: Response): Promise<Response> => {
        const data = req.body;

        const user = await this.authenticateService.registerUser(data);

        return res.status(201).json(user);
    };

    loginUser = async (req: Request, res: Response): Promise<Response> => {
        const { email, password } = req.body;

        const user = await this.authenticateService.loginUser({ email, password });

        return res.status(200).json(user);
    };

    showAuthenticatedUser = async (req: Request, res: Response): Promise<Response> => {};
}
