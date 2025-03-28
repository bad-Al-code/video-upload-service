import express, {
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from 'express';
import { StatusCodes } from 'http-status-codes';
import { join } from 'node:path';
import { rename, unlink } from 'node:fs/promises';

import { ENV } from './config/env';
import { AppError, BadRequestError, InternalServerError } from './errors';
import { ensureDirectoryExists } from './utils/fsUtils';
import { MAX_FILE_SIZE_MB, TEMP_DIR, UPLOAD_DIR } from './config/constants';
import { upload } from './config/multer';
import { MulterError } from 'multer';

const app = express();
const PORT = ENV.PORT;

ensureDirectoryExists(UPLOAD_DIR);
ensureDirectoryExists(TEMP_DIR);

app.use(json());
app.use(urlencoded({ extended: true }));

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
  console.log(`Server is running on http://localhost:${PORT}`);
});
