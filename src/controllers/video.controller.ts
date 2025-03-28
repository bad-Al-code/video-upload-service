import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { join } from 'node:path';
import { rename, unlink } from 'node:fs/promises';

import { TEMP_DIR } from '../config/constants';
import { BadRequestError, InternalServerError } from '../errors';

export const processVideoUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.file) {
    return next(new BadRequestError('No video file uploaded.'));
  }

  const sourcePath = req.file.path;
  const destinationFilename = req.file.filename;
  const destinationPath = join(TEMP_DIR, destinationFilename);

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
};
