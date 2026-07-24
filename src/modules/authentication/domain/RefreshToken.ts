export type RefreshToken = {
    id: string;
    hashedToken: string;
    userId: string;
    expiresAt: Date;
    revoked: boolean;
    createdAt: Date;
    updatedAt: Date;
};
