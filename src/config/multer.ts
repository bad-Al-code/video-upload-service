import { v4 as uuidv4 } from 'uuid';
import multer, { diskStorage, FileFilterCallback } from 'multer';
import { Request } from 'express';
import { extname } from 'node:path';

import { BadRequestError } from '../errors';
import {
  UPLOAD_DIR,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_MB,
} from './constants';

const storage = diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}${extname(file.originalname)}`;
    cb(null, uniqueSuffix);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const fileExtension = extname(file.originalname).toLowerCase();
  const isMimeTypeAllowed = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
  const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(fileExtension);

  if (
    isMimeTypeAllowed ||
    (file.mimetype === 'application/octet-stream' && isExtensionAllowed)
  ) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        `Invalid file type. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`,
      ),
    );
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});
