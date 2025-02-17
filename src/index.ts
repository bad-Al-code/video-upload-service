import 'dotenv/config';
import { redis } from './config/db';
import { cacheService } from './services/cache.service';

async function testCache() {
    await cacheService.set('A', { name: 'One', age: 10 }, 3600);
    const user = await cacheService.get('A');

    console.log('Cache: ', user);

    await cacheService.del('A');
}

async function main() {
    await redis;

    await testCache();
}

main();
