import express from 'express';

import { pageCacheRouter } from './routes/page.route';

const app = express();

app.use(express.static('src/views'));

app.use('/api', pageCacheRouter);

export default app;
