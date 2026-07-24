import { AppError } from '@/app/exceptions/AppError';
import { resetAuthRateLimits } from '@/app/http/middlewares/rate-limiter.middleware';
import { setRefreshTokenCookie } from '@/app/utils/set-refresh-token-cookie';
import { Request, Response } from 'express';
import { AuthenticateUserService } from './authentication.services';

export class AuthenticateController {
    constructor(private readonly authenticateService: AuthenticateUserService) {}

    registerUser = async (req: Request, res: Response): Promise<Response> => {
        const data = req.body;

        const user = await this.authenticateService.registerUser(data);

        return res.status(201).json(user);
    };

    loginUser = async (req: Request, res: Response): Promise<Response> => {
        const { email, password } = req.body;
        const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
        const userAgentString = req.headers['user-agent'] ?? 'unknow';

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
        const userAgentString = req.headers['user-agent'] ?? 'unknow';

        const { token, refreshToken: newRefreshToken, refreshTokenExpiresAt } = await this.authenticateService.refresh(refreshToken, ipAddress, userAgentString);
        setRefreshTokenCookie(res, newRefreshToken, refreshTokenExpiresAt);

        return res.status(200).json({ token });
    };

    logout = async (req: Request, res: Response): Promise<Response> => {
        const refreshToken = req.cookies?.refreshToken;

        try {
            await this.authenticateService.revokeByRawToken(refreshToken);
        } catch (_error) {
            /* empty */
        }

        res.clearCookie('refreshToken', { path: '/api/auth' });
        return res.status(204).send();
    };

    revokeAllUserTokens = async (req: Request, res: Response): Promise<Response> => {
        const userId = req.user.id;

        // Recebe a decisão do Front-end (padrão: desconectar tudo)
        const keepCurrentSession = req.body?.keepCurrentSession || false;

        // Recupera o Refresh Token atual do cookie
        const refreshTokenString = req.cookies.refreshToken;

        // Executa o caso de uso
        const { accessToken } = await this.authenticateService.revokeSessionsService(userId, keepCurrentSession, refreshTokenString);

        // Se 'accessToken' é nulo, significa que foi um LOGOUT GLOBAL.
        if (!accessToken) {
            res.clearCookie('refreshToken', { path: '/' }); // Limpa o cookie do navegador
            return res.json({ message: 'Você foi desconectado de todos os dispositivos.' });
        }

        // Se há um token novo, a sessão atual foi preservada.
        return res.json({
            message: 'Todos os outros dispositivos foram desconectados. Sua sessão atual foi mantida.',
            accessToken,
        });
    };
}
