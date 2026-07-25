import { AppError } from '@/app/exceptions/AppError';
import { resetAuthRateLimits } from '@/app/http/middlewares/rate-limiter.middleware';
import { logger } from '@/app/utils/logger';
import { setRefreshTokenCookie } from '@/app/utils/set-refresh-token-cookie';
import { env } from '@/env';
import { Request, Response } from 'express';
import { AuthenticateUserService } from './authentication.services';

export class AuthenticateController {
    constructor(private readonly authenticateService: AuthenticateUserService) {}

    loginUser = async (req: Request, res: Response): Promise<Response> => {
        const { email, password } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
        const userAgentString = req.headers['user-agent'] ?? 'unknown';

        const { user, token, refreshToken, refreshTokenExpiresAt } = await this.authenticateService.loginUser({ email, password }, ipAddress, userAgentString);
        setRefreshTokenCookie(res, refreshToken, refreshTokenExpiresAt);
        await resetAuthRateLimits(ipAddress, email);

        return res.status(200).json({ user, token });
    };

    refreshToken = async (req: Request, res: Response): Promise<Response> => {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
        const userAgentString = req.headers['user-agent'] ?? 'unknown';

        const { accessToken, newRawRefreshToken: newRefreshToken, expiresAt } = await this.authenticateService.refresh(refreshToken, ipAddress, userAgentString);
        setRefreshTokenCookie(res, newRefreshToken, expiresAt);

        return res.status(200).json({ accessToken });
    };

    logout = async (req: Request, res: Response): Promise<Response> => {
        const refreshToken = req.cookies?.refreshToken;

        try {
            await this.authenticateService.revokeByRawToken(refreshToken);
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

        await this.authenticateService.createResetPassword(email);

        return res.status(200).send();
    };

    resetPassword = async (req: Request, res: Response): Promise<Response> => {
        const { resetPasswordToken, password } = req.body;

        await this.authenticateService.resetPassword(resetPasswordToken, password);

        return res.status(200).json({ message: 'Operação realizada com sucesso.' });
    };

    changeAuthenthicatedUserPassword = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;
        const refreshToken = req.cookies?.refreshToken;
        const { oldPassword, newPassword } = req.body;

        const user = await this.authenticateService.changeAuthenthicatedUserPassword(userId, newPassword, refreshToken, oldPassword);

        return res.status(200).json(user);
    };

    revokeAllUserTokens = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;

        // Recebe a decisão do Front-end (padrão: desconectar tudo)
        const keepCurrentSession = req.body?.keepCurrentSession || false;

        // Recupera o Refresh Token atual do cookie
        const refreshTokenString = req.cookies?.refreshToken;

        // Executa o caso de uso
        const { accessToken } = await this.authenticateService.revokeSessionsService(userId, keepCurrentSession, refreshTokenString);

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
