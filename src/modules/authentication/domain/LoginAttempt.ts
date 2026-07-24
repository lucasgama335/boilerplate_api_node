export type LoginAttempt = {
    id: string;
    status: 'success' | 'fail';
    ipAddress: string;
    createdAt: Date;
};
