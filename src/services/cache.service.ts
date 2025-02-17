import { redis } from '../config/db';

interface CacheService {
    set: (key: string, value: any, expiration?: number) => Promise<void>;
    get: (key: string) => Promise<any>;
    del: (key: string) => Promise<void>;
}

const cacheService: CacheService = {
    /**
     * @param key
     * @param value
     * @param expiration
     */
    async set(key, value, expiration = 3000) {
        try {
            const data = JSON.stringify(value);
            await redis.set(key, data, 'EX', expiration);

            console.log(`Cached: ${key}`);
        } catch (error) {
            console.error(`Error cacching ${key}: `, error);
        }
    },

    /**
     * @param key
     * @returns
     */
    async get(key) {
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`Error fetching cache ${key}:`, error);
            return null;
        }
    },

    /**
     * @param key
     */
    async del(key) {
        try {
            await redis.del(key);
            console.log(`Deleted cache: ${key}`);
        } catch (error) {
            console.error(`Error deleting cache ${key}:`, error);
        }
    },
};

export { cacheService };
