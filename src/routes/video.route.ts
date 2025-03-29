import { Router } from 'express';

import { upload } from '../config/multer';
import {
  processVideoUpload,
  getVideoDetails,
} from '../controllers/video.controller';

const router = Router();

router.post('/video', upload.single('videoFile'), processVideoUpload);

router.get('/videos/:videoId', getVideoDetails);

export { router as videoRouter };
