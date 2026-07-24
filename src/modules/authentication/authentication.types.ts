import { loginAttempts, refreshTokens } from '../../database/schema';
import type { SafeUser, User } from '../users/users.types';

// ==========================================
// REFRESH TOKENS
// ==========================================

// Tipos Base
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type CreateRefreshToken = typeof refreshTokens.$inferInsert;

// Composições
export type RefreshTokenWithUser = RefreshToken & {
    user: User; // Um token sempre pertence a um usuário (notNull no schema)
};

export type RefreshTokenWithSafeUser = RefreshToken & {
    user: SafeUser; // Ideal para rotas que listam as sessões ativas do usuário
};

// ==========================================
// LOGIN ATTEMPTS
// ==========================================

// Tipos Base
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type CreateLoginAttempt = typeof loginAttempts.$inferInsert;

// Composições
export type LoginAttemptWithUser = LoginAttempt & {
    // O usuário pode ser nulo aqui, pois tentativas de login falhas
    // podem ocorrer com e-mails não cadastrados
    user: User | null;
};
