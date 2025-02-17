import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { cacheService } from '../services/cache.service';

const router = Router();

const cacheValidationSchema = z.object({
    refresh: z.enum(['true', 'false']).optional(),
});

router.get('/page', async (req: Request, res: Response) => {
    try {
        const validation = cacheValidationSchema.safeParse(req.query);

        if (!validation.success) {
            res.status(400).json({ error: 'Invalid query parameter' });
            return;
        }

        const { refresh } = req.query;
        const cacheKey = 'page:index';

        if (refresh === 'true') {
            await cacheService.cachePage(cacheKey, 'views/index.html');
        }

        const cachedPage = await cacheService.getCachePage(cacheKey);
        if (!cachedPage) {
            res.status(404).send('Cached page not found');
            return;
        }

        res.send(cachedPage);
    } catch (error) {
        console.error('Error serving cached page: ', error);
        res.status(500).send('Internal server error');
    }
});

export { router as pageCacheRouter };
