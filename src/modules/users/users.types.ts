import { users } from '../../database/schema';
// Usamos 'import type' pelo mesmo motivo arquitetural
import type { LoginAttempt, RefreshToken } from '../authentication/authentication.types';

// ==========================================
// USERS
// ==========================================

// Tipos Base
export type User = typeof users.$inferSelect;
export type CreateUser = typeof users.$inferInsert;

// Tipo Seguro (Data Transfer Object para a web)
export type SafeUser = Omit<User, 'passwordHash' | 'totpSecret'>;

// ==========================================
// COMPOSIÇÕES
// ==========================================

// Usuário com suas sessões ativas
export type UserWithTokens = User & {
    refreshTokens: RefreshToken[];
};

// Versão segura do usuário com suas sessões
export type SafeUserWithTokens = SafeUser & {
    refreshTokens: RefreshToken[];
};

// Usuário com histórico de segurança (Log de acessos)
export type UserWithLoginAttempts = User & {
    loginAttempts: LoginAttempt[];
};
