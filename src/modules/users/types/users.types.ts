import { users } from '../../../database/schema';
import { LoginAttempt, RefreshToken } from '../../authentication/types/authentication.types';
import { Department } from '../../departments/types/departments.types';
import { Permission } from '../../permissions/types/permissions.types';

// ==========================================
// USERS BASE
// ==========================================
export type User = typeof users.$inferSelect & {
    departments?: Department[];
    permissions?: Permission[];
};

export type CreateUserDTO = typeof users.$inferInsert & {
    departments?: string[];
};

// ==========================================
// SANITIZAÇÃO (SAFE USER)
// ==========================================
const SENSITIVE_USER_FIELDS = ['passwordHash', 'totpSecret'] as const;
export type SafeUser = Omit<User, (typeof SENSITIVE_USER_FIELDS)[number]>;

// Função Genérica: Limpa os campos sensíveis sem perder as relações (departments, tokens, etc)
export function toSafeUser<T extends User>(user: T): Omit<T, (typeof SENSITIVE_USER_FIELDS)[number]> {
    const clone = { ...user };
    for (const field of SENSITIVE_USER_FIELDS) delete (clone as Record<string, unknown>)[field];
    return clone;
}

// ==========================================
// COMPOSIÇÕES BRUTAS (Usadas pelo Repository e Regras de Negócio)
// (Contêm passwordHash e totpSecret)
// ==========================================
export type UserWithDepartments = User & { departments: Department[] };
export type UserWithPermissions = User & { permissions: Permission[] };
export type UserWithDepartmentsAndPermissions = UserWithDepartments & UserWithPermissions;
export type UserWithTokens = User & { refreshTokens: RefreshToken[] };
export type UserWithLoginAttempts = User & { loginAttempts: LoginAttempt[] };

// ==========================================
// COMPOSIÇÕES SEGURAS (Usadas nos retornos para o Front-end/Controllers)
// (Não contêm campos sensíveis)
// ==========================================
export type SafeUserWithDepartments = Omit<UserWithDepartments, (typeof SENSITIVE_USER_FIELDS)[number]>;
export type SafeUserWithPermissions = Omit<UserWithPermissions, (typeof SENSITIVE_USER_FIELDS)[number]>;
export type SafeUserWithDepartmentsAndPermissions = Omit<UserWithDepartmentsAndPermissions, (typeof SENSITIVE_USER_FIELDS)[number]>;
export type SafeUserWithTokens = Omit<UserWithTokens, (typeof SENSITIVE_USER_FIELDS)[number]>;
