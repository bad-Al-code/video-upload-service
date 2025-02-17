import 'dotenv/config';
import { redis } from './config/db';
import { cacheService } from './services/cache.service';

async function testCache() {
    await cacheService.set('A', { name: 'One', age: 10 }, 3600);
    const ttl = await cacheService.ttl('A');

    await cacheService.setBulk([
        { key: 'B', value: { name: 'Two' }, expiration: 1200 },
        { key: 'C', value: { name: 'Three' }, expiration: 1500 },
    ]);

    const users = await cacheService.getBulk(['A', 'B', 'C']);

    console.log('Fetched Users: ', users);

    await cacheService.del('A');
}

async function main() {
    await redis;

    await testCache();
}

main();
