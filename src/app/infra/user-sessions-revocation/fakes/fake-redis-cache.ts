import { IRedisCache } from '../UserSessionsRevocationProvider';

export class InMemoryRedisCache implements IRedisCache {
    private readonly store = new Map<string, string>();

    async get(key: string): Promise<string | null> {
        return this.store.has(key) ? this.store.get(key)! : null;
    }

    async set(key: string, value: string): Promise<'OK'> {
        this.store.set(key, value);
        return 'OK';
    }

    async del(key: string): Promise<number> {
        return this.store.delete(key) ? 1 : 0;
    }
}
