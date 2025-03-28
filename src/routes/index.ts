import { Router } from 'express';
import { videoRouter } from './video.route';

const mainRouter = Router();

mainRouter.use('/upload', videoRouter);

export default mainRouter;
