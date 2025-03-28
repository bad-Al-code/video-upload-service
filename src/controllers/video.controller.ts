import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { join } from 'node:path';
import { rename, unlink } from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

import { TEMP_DIR } from '../config/constants';
import { BadRequestError, InternalServerError } from '../errors';
import { db, schema } from '../db';

const { videos } = schema;

export const processVideoUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.file) {
    return next(new BadRequestError('No video file data found on request.'));
  }

  const {
    originalname,
    mimetype,
    size,
    path: sourcePath,
    filename: uniqueMulterFilename,
  } = req.file;
  const videoId = uuidv4();
  const destinationPath = join(TEMP_DIR, uniqueMulterFilename);

  console.log(`Received file: ${originalname} (${mimetype}), Size: ${size}`);
  console.log(`Generated Video ID: ${videoId}`);
  console.log(`Multer temp path: ${sourcePath}`);
  console.log(`Final temp path planned: ${destinationPath}`);

  try {
    console.log(`Attempting to insert video record with ID: ${videoId}`);
    await db.insert(videos).values({
      id: videoId,
      orignalFilename: originalname,
      mimeType: mimetype,
      sizeBytes: size,
      status: 'PENDING_UPLOAD',
    });
    console.log(`Successfully inserted initial video record: ${videoId}`);
  } catch (dbError: any) {
    console.error(`Database insert failed for video ${videoId}:`, dbError);
    try {
      await unlink(sourcePath);
      console.log(
        `Cleaned up multer file ${sourcePath} after DB insert failure.`,
      );
    } catch (cleanupError: any) {
      console.error(
        `Failed to cleanup multer file ${sourcePath} after DB insert failure:`,
        cleanupError,
      );
    }
    return next(
      new InternalServerError('Failed to initiate video record in database.'),
    );
  }

  try {
    await rename(sourcePath, destinationPath);
    console.log(`Successfully moved file to temp dir: ${destinationPath}`);

    try {
      console.log(`Updating DB status to PROCESSING for video ID: ${videoId}`);
      await db
        .update(videos)
        .set({
          status: 'PROCESSING',
        })
        .where(eq(videos.id, videoId));
      console.log(`Successfully updated DB status for video ID: ${videoId}`);

      res.status(StatusCodes.OK).json({
        message: 'Video upload initiated successfully.',
        videoId: videoId,
        tempFilename: uniqueMulterFilename,
      });
    } catch (dbUpdateError: any) {
      console.error(
        `Database update failed for video ${videoId} after file move:`,
        dbUpdateError,
      );

      return next(
        new InternalServerError(
          'File stored but failed to update video status in database.',
        ),
      );
    }
  } catch (moveError: any) {
    console.error(
      `Failed to move file from ${sourcePath} to ${destinationPath}:`,
      moveError,
    );

    try {
      console.log(
        `Updating DB status to UPLOAD_FAILED for video ID: ${videoId}`,
      );
      await db
        .update(videos)
        .set({ status: 'UPLOAD_FAILED' })
        .where(eq(videos.id, videoId));
      console.log(
        `Successfully updated DB status to FAILED for video ID: ${videoId}`,
      );
    } catch (dbFailError: any) {
      console.error(
        `Failed to update DB status to FAILED for video ${videoId} after move error:`,
        dbFailError,
      );
    }

    try {
      await unlink(sourcePath);
      console.log(
        `Cleaned up intermediate file ${sourcePath} after move error.`,
      );
    } catch (cleanupError: any) {
      console.error(
        `Failed to cleanup intermediate file ${sourcePath}:`,
        cleanupError,
      );
    }

    return next(
      new InternalServerError(
        'Failed to process and store the uploaded video file.',
      ),
    );
  }
};
