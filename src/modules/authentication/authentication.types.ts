export type LoginAttempt = {
    id: string;
    status: 'success' | 'fail';
    ipAddress: string;
    createdAt: Date;
};

export type RefreshToken = {
    id: string;
    hashedToken: string;
    userId: string;
    expiresAt: Date;
    revoked: boolean;
    createdAt: Date;
    updatedAt: Date;
};
