import { Request, Response, Router } from 'express';

export const routes = Router();

routes.get('/', (_req: Request, res: Response) => {
    return res.status(200).json({ message: 'Olá mundo' });
});

routes.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
