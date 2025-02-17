import { redis } from '../config/db';

interface CacheService {
    set: (key: string, value: any, expiration?: number) => Promise<void>;
    get: (key: string) => Promise<any>;
    del: (key: string) => Promise<void>;
    ttl: (key: string) => Promise<number | null>;
    setBulk: (
        items: { key: string; value: any; expiration?: number }[],
    ) => Promise<void>;
    getBulk: (keys: string[]) => Promise<Record<string, any>>;
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

    /**
     * @param key
     * @returns
     */
    async ttl(key) {
        try {
            const time = await redis.ttl(key);
            return time >= 0 ? time : null;
        } catch (error) {
            console.error(`Error getting TTL for ${key}: `, error);
            return null;
        }
    },

    /**
     * @param items
     */
    async setBulk(items) {
        try {
            const pipeline = redis.pipeline();
            items.forEach(({ key, value, expiration = 3600 }) => {
                const data = JSON.stringify(value);
                if (expiration > 0) {
                    pipeline.set(key, data, 'EX', expiration);
                } else {
                    pipeline.set(key, data);
                }
            });
            await pipeline.exec();
            console.log(`Bulk cached ${items.length} items`);
        } catch (error) {
            console.error(`Error in bulk caching:`, error);
        }
    },

    /**
     * @param keys
     * @returns
     */
    async getBulk(keys) {
        try {
            const results = await redis.mget(keys);
            return keys.reduce(
                (acc, key, index) => {
                    if (results[index]) {
                        acc[key] = JSON.parse(results[index]!);
                    }
                    return acc;
                },
                {} as Record<string, any>,
            );
        } catch (error) {
            console.error(`Error in bulk fetching:`, error);
            return {};
        }
    },
};

export { cacheService };
