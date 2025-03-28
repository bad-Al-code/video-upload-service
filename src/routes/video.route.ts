import { Router } from 'express';

import { upload } from '../config/multer';
import { processVideoUpload } from '../controllers/video.controller';

const router = Router();

router.post('/video', upload.single('videoFile'), processVideoUpload);

export { router as videoRouter };
