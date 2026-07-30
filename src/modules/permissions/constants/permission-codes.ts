// modules/permissions/constants/permission-codes.ts
export const PERMISSION_CODES = [
    'users:create',
    'users:show',
    'departments:show',
    'departments:create',
    'departments:update',
    'departments:delete',
    'permissions:show',
    'permissions:create',
    'permissions:update',
    'permissions:delete',
    'userAccess:manage',
    // ... resto dos códigos reais que hoje existem espalhados nas rotas
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];
