export type User = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isEmailConfirmed: boolean;
    totpSecret: string | null;
    isTwoFactorEnabled: boolean;
    tokensRevokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export type UserWithPassword = User & {
    passwordHash: string;
};

export type CreateUserData = {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
};
