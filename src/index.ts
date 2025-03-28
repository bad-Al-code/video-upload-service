import express, {
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from 'express';
import { StatusCodes } from 'http-status-codes';
import { extname, join } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, fstat, mkdirSync } from 'node:fs';
import multer, { diskStorage, FileFilterCallback, MulterError } from 'multer';

import { ENV } from './config/env';
import { AppError, BadRequestError, InternalServerError } from './errors';
import { rename, unlink } from 'node:fs/promises';

const app = express();
const PORT = ENV.PORT;

const UPLOAD_DIR = join(__dirname, '..', 'uploads');
const TEMP_DIR = join(__dirname, '..', 'temp');

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Created upload Directory: ${UPLOAD_DIR}`);
}

if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
  console.log(`Created temp directory: ${TEMP_DIR}`);
}

const storage = diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${uuidv4()}${extname(file.originalname)}`;
    cb(null, uniqueSuffix);
  },
});

const MAX_FILE_SIZE_MB = ENV.MAX_FILE_SIZE_MB;
const ALLOWED_EXTENSIONS = ['.mp4', '.mpeg', '.mov', '.webm', '.avi', '.mkv'];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
];

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  console.log(
    `DEBUG: Detected file mimetype for ${file.originalname}: ${file.mimetype}`,
  );
  const fileExtension = extname(file.originalname).toLowerCase();
  console.log(`DEBUG: Detected file extension: ${fileExtension}`);

  const isMimeTypeAllowed = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
  const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(fileExtension);

  if (
    isMimeTypeAllowed ||
    (file.mimetype === 'application/octet-stream' && isExtensionAllowed)
  ) {
    console.log(
      `Accepting file: Mime allowed: ${isMimeTypeAllowed}, Ext allowed: ${isExtensionAllowed}`,
    );
    cb(null, true);
  } else {
    console.error(
      `Rejected file: Mime type '${file.mimetype}', Extension: '${fileExtension}'. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}, Allowed Extenstions: ${ALLOWED_EXTENSIONS.join(', ')}`,
    );

    cb(
      new BadRequestError(
        `Invalid file type. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`,
      ),
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

app.use(json());
app.use(urlencoded({ extended: true }));

app.get('/ping', (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ message: 'Pong' });
});

app.post('/upload/video', (req: Request, res: Response, next: NextFunction) => {
  const uploader = upload.single('videoFile');

  uploader(req, res, async (err: any) => {
    if (err instanceof MulterError) {
      return next(err);
    } else if (err instanceof AppError) {
      return next(err);
    } else if (err) {
      console.error('Unexpected error during upload middleware: ', err);
      return next(
        new InternalServerError('Failed during file upload processing.'),
      );
    }

    if (!req.file) {
      return next(
        new BadRequestError(
          'No video file uploaded. Ensure the field name is "videoFile".',
        ),
      );
    }

    const sourcePath = req.file.path;
    const destinationFilename = req.file.filename;
    const destinationPath = join(TEMP_DIR, destinationFilename);

    console.log(
      `Receieved File: ${req.file.originalname} (${req.file.mimetype})`,
    );
    console.log(`Temporary location (Multer): ${sourcePath}`);
    console.log(`Final temporary location planned: ${destinationPath}`);

    try {
      await rename(sourcePath, destinationPath);
      console.log(`Successfully moved file to ${destinationPath}`);

      res.status(StatusCodes.OK).json({
        message: 'video uploaded successfully.',
        tempFilename: destinationFilename,
      });
    } catch (moveError: any) {
      console.error(
        `Failed to move file from ${sourcePath} to ${destinationPath}: `,
        moveError,
      );

      try {
        await unlink(sourcePath);
        console.log(`Cleaned up temporary multer file: ${sourcePath}`);
      } catch (cleanupError: any) {
        console.error(
          `Failed tp cleanup multer file ${sourcePath}: `,
          cleanupError,
        );
      }

      return next(
        new InternalServerError(
          'Failed to process and store the uploaded video.',
        ),
      );
    }
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandler error: ', err);

  let statusCode: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR;
  let responseBody: any = {
    status: 'error',
    message: 'Something went wrong',
  };

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = StatusCodes.BAD_REQUEST;
      responseBody.message = `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
    } else {
      statusCode = StatusCodes.BAD_REQUEST;
      responseBody.message = `File upload error: ${err.message}`;
    }
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    responseBody.message = err.message;
  } else {
    const internalError = new InternalServerError(
      err.message || 'An unexpected error occured',
    );
    statusCode = internalError.statusCode;
    responseBody.message = internalError.message;
  }

  responseBody.statusCode = statusCode;

  res.status(statusCode).json(responseBody);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost"${PORT}`);
});
