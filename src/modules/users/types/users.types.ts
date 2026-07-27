import { users } from '../../../database/schema';
import { LoginAttempt, RefreshToken } from '../../authentication/types/authentication.types';
import { Department } from '../../departments/types/departments.types';
// Usamos 'import type' pelo mesmo motivo arquitetural
import { Permission } from '../../permissions/types/permissions.types';

// ==========================================
// USERS
// ==========================================

// Tipos Base
export type User = typeof users.$inferSelect & {
    departments?: Department[];
    permissions?: Permission[];
};
export type CreateUserDTO = typeof users.$inferInsert & {
    departments?: string[];
};

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

export type SafeUserWithPermissions = SafeUser & {
    permissions: Permission[];
};

export type SafeUserWithDepartments = SafeUser & {
    departments: Department[];
};

export type SafeUserWithDepartmentsAndPermissions = SafeUserWithDepartments & {
    permissions: Permission[];
};
