import { AppError } from '@/app/exceptions/AppError';
import { ITokenProvider } from '@/app/infra/token/ITokenProvider';
import { hashToken } from '@/app/utils/hash-token';
import 'dotenv/config';
import crypto from 'node:crypto';
import { IRefreshTokenRepository } from '../domain/IRefreshTokenRepository';

export class RefreshTokensService {
    constructor(
        private readonly refreshTokenRepository: IRefreshTokenRepository,
        private readonly tokenProvider: ITokenProvider,
    ) {}

    async refresh(rawToken: string) {
        const hashedToken = hashToken(rawToken);
        const tokenRecord = await this.refreshTokenRepository.findByTokenHash(hashedToken);

        if (!tokenRecord) {
            throw new AppError('Refresh token não encontrado.', 401);
        }

        // Valida se já foi revogado
        if (tokenRecord.revoked) {
            // Dica de segurança avançada: Se um token revogado for tentado,
            // pode indicar roubo de token. Aqui poderíamos revogar todos os tokens do usuário.
            throw new AppError('Refresh token inválido ou já utilizado.', 401);
        }

        // Valida se expirou
        const ahora = new Date();
        if (ahora > new Date(tokenRecord.expiresAt)) {
            throw new AppError('Refresh token expirado.', 401);
        }

        // ROTAÇÃO DE TOKEN: Revoga o token atual para que não possa ser reutilizado
        await this.refreshTokenRepository.revokeToken(tokenRecord.id);

        // Gera um novo Access Token
        const accessToken = this.tokenProvider.generate(tokenRecord.userId);

        // Gera um novo Refresh Token (par de rotação)
        const newRawRefreshToken = crypto.randomBytes(64).toString('hex');
        const newHashedRefreshToken = hashToken(newRawRefreshToken);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (Number(process.env.REFRESH_TOKEN_EXPIRES_AT) || 7));
        // expiresAt.setTime(expiresAt.getTime() + 10 * 1000);

        await this.refreshTokenRepository.create(tokenRecord.userId, newHashedRefreshToken, expiresAt);

        return { token: accessToken, refreshToken: newRawRefreshToken };
    }
}
