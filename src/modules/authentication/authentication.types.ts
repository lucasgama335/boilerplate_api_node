export type LoginAttempt = {
    id: string;
    status: 'success' | 'fail';
    ipAddress: string;
    email: string | null;
    userId: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    browser: string | null;
    os: string | null;
    deviceType: string | null;
    createdAt: Date;
};

export type RefreshToken = {
    id: string;
    hashedToken: string;
    userId: string;
    expiresAt: Date;
    revoked: boolean;
    ipAddress: string;
    city: string | null;
    region: string | null;
    country: string | null;
    browser: string | null;
    os: string | null;
    deviceType: string | null;
    createdAt: Date;
    updatedAt: Date;
};
