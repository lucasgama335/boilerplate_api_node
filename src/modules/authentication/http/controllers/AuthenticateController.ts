import { AppError } from '@/app/exceptions/AppError';
import { setRefreshTokenCookie } from '@/app/utils/set-refresh-token-cookie';
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
        const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';

        const { user, token, refreshToken, refreshTokenExpiresAt } = await this.authenticateService.loginUser({ email, password }, ipAddress);
        setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);

        return res.status(200).json({ user, token });
    };

    refreshToken = async (req: Request, res: Response): Promise<Response> => {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const { token, refreshToken: newRefreshToken, refreshTokenExpiresAt } = await this.refreshTokensService.refresh(refreshToken);
        setRefreshTokenCookie(res, newRefreshToken, refreshTokenExpiresAt);

        return res.status(200).json({ token });
    };

    logout = async (req: Request, res: Response): Promise<Response> => {
        const refreshToken = req.cookies?.refreshToken;

        await this.refreshTokensService.refresh(refreshToken);

        res.clearCookie('refreshToken', { path: '/api/auth' });
        return res.status(204).send();
    };
}
