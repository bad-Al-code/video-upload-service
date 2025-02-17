import 'dotenv/config';
import { redis } from './config/db';
import { cacheService } from './services/cache.service';

async function cacheStaticPage() {
    const cacheKey = 'page:index';
    const cachedPage = await cacheService.getCachePage(cacheKey);

    if (!cachedPage) {
        console.log('No cached page found. Caching now...');
        await cacheService.cachePage(cacheKey, 'views/index.html');
    } else {
        console.log('Page is already cached');
    }
}
async function main() {
    await redis;

    cacheStaticPage();
}

main();
