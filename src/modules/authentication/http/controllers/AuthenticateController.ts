import { Request, Response } from 'express';
import { AuthenticateUserService } from '../../application/AuthenticateUserService';
import { RefreshTokensService } from '../../application/RefreshTokensService';

export class AuthenticateController {
    // 1. A Injeção de Dependência entra aqui no Construtor!
    constructor(
        private readonly authenticateService: AuthenticateUserService,
        private readonly refreshTokensService: RefreshTokensService,
    ) {}

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

    refreshToken = async (req: Request, res: Response): Promise<Response> => {
        const { refreshToken } = req.body;

        const user = await this.refreshTokensService.refresh(refreshToken);

        return res.status(200).json(user);
    };
}
