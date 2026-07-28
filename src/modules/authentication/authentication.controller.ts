import { AppError } from '@/app/exceptions/AppError';
import { logger } from '@/app/utils/logger';
import { setRefreshTokenCookie } from '@/app/utils/set-refresh-token-cookie';
import { env } from '@/env';
import { Request, Response } from 'express';
import { AuthenticationService } from './authentication.service';

export class AuthenticationController {
    constructor(private readonly authenticationService: AuthenticationService) {}

    loginUser = async (req: Request, res: Response): Promise<Response> => {
        const { email, password } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
        const userAgentString = req.headers['user-agent'] ?? 'unknown';

        const { user, accessToken, refreshToken, refreshTokenExpiresAt } = await this.authenticationService.loginUser({ email, password }, ipAddress, userAgentString);
        setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);

        return res.status(200).json({ user, accessToken });
    };

    refreshToken = async (req: Request, res: Response): Promise<Response> => {
        const userSessionRefreshToken = req.cookies?.refreshToken;
        if (!userSessionRefreshToken) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
        const userAgentString = req.headers['user-agent'] ?? 'unknown';

        const { accessToken, refreshToken, expiresAt } = await this.authenticationService.refresh(userSessionRefreshToken, ipAddress, userAgentString);

        // Dentro do grace period a rotação é suprimida (newRawRefreshToken vem null) —
        // não mexemos no cookie existente, o cliente mantém o refresh token que já tinha.
        if (refreshToken && expiresAt) {
            setRefreshTokenCookie(res, refreshToken, expiresAt);
        }

        return res.status(200).json({ accessToken });
    };

    logout = async (req: Request, res: Response): Promise<Response> => {
        const refreshToken = req.cookies?.refreshToken;

        try {
            await this.authenticationService.revokeByRawToken(refreshToken);
        } catch (error) {
            // Não travamos o logout do usuário por isso, mas registramos —
            // foi justamente um erro silencioso desse tipo que escondeu o bug crítico anterior.
            logger.warn({ err: error }, 'Falha ao revogar refresh token durante logout');
        }

        res.clearCookie('refreshToken', { path: env.AUTH_ROUTE_PREFIX });
        return res.status(204).send();
    };

    forgotPassword = async (req: Request, res: Response): Promise<Response> => {
        const { email } = req.body;

        await this.authenticationService.createResetPassword(email);

        return res.status(200).send();
    };

    resetPassword = async (req: Request, res: Response): Promise<Response> => {
        const { resetPasswordToken, password } = req.body;

        await this.authenticationService.resetPassword(resetPasswordToken, password);

        return res.status(200).json({ message: 'Operação realizada com sucesso.' });
    };

    changeAuthenticatedUserPassword = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;
        const refreshToken = req.cookies?.refreshToken;
        const { oldPassword, newPassword } = req.body;

        const user = await this.authenticationService.changeAuthenticatedUserPassword(userId, newPassword, refreshToken, oldPassword);

        return res.status(200).json(user);
    };

    revokeAllUserTokens = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;
        const keepCurrentSession = req.body.keepCurrentSession; // Zod agarante que esse valor chegará aqui

        // Recupera o Refresh Token atual do cookie
        const refreshTokenString = req.cookies?.refreshToken;

        // Executa o caso de uso
        const { accessToken } = await this.authenticationService.revokeSessionsService(userId, keepCurrentSession, refreshTokenString);

        // Se 'accessToken' é nulo, significa que foi um LOGOUT GLOBAL.
        if (!accessToken) {
            res.clearCookie('refreshToken', { path: env.AUTH_ROUTE_PREFIX });
            return res.json({ message: 'Você foi desconectado de todos os dispositivos.' });
        }

        // Se há um token novo, a sessão atual foi preservada.
        return res.json({
            message: 'Todos os outros dispositivos foram desconectados. Sua sessão atual foi mantida.',
            accessToken,
        });
    };
}
