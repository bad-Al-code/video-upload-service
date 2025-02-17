import path from 'node:path';
import fs from 'node:fs/promises';

import { redis } from '../config/db';

interface CacheService {
    cachePage: (
        key: string,
        filePath: string,
        expiration?: number,
    ) => Promise<void>;
    getCachePage: (key: string) => Promise<string | null>;
}

const cacheService: CacheService = {
    async cachePage(key: string, filePath: string, expiration = 600) {
        try {
            const htmlContent = await fs.readFile(
                path.resolve(__dirname, '..', filePath),
                'utf-8',
            );
            await redis.set(key, htmlContent, 'EX', expiration);

            console.log(`Cached HTML page: ${key} (Expires in ${expiration})`);
        } catch (error) {
            console.error(`Error caching page ${key}: `, error);
        }
    },

    async getCachePage(key: string): Promise<string | null> {
        try {
            return await redis.get(key);
        } catch (error) {
            console.error(`Error grtching cached page ${key}: `, error);
            return null;
        }
    },
};

export { cacheService };
