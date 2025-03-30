import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { extname } from 'node:path';
import { unlink, stat } from 'node:fs/promises';
import * as fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';

import {
  BadRequestError,
  InternalServerError,
  AppError,
  NotFoundError,
} from '../errors';
import { db, schema } from '../db';
import { s3Client } from '../config/s3Client';
import { ENV } from '../config/env';
import { z } from 'zod';
import { VideoEventProducer } from '../producers/VideoProducer';
import { VideoStatus } from '../db/schema';
import { VIDEO_UPLOAD_COMPLETED_ROUTING_KEY } from '../config/constants';

const { videos } = schema;

const videoEventProducer = new VideoEventProducer();

async function insertInitialVideoRecord(videoData: {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: VideoStatus;
}): Promise<void> {
  console.log(`Attempting DB insert for video ID: ${videoData.id}`);
  try {
    await db.insert(videos).values(videoData);
    console.log(`DB insert successful for video ID: ${videoData.id}`);
  } catch (error: any) {
    console.error(`Database insert failed for video ${videoData.id}:`, error);
    throw new InternalServerError(
      `Database insert failed: ${error.message || error}`,
    );
  }
}

async function uploadFileToS3(
  bucket: string,
  key: string,
  filePath: string,
  contentType: string,
): Promise<string | undefined> {
  console.log(`Attempting S3 upload: Bucket=${bucket}, Key=${key}`);
  let fileStream;
  try {
    fileStream = fs.createReadStream(filePath);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileStream,
      ContentType: contentType,
    });

    const uploadResult = await s3Client.send(command);
    console.log(`S3 upload successful. ETag: ${uploadResult.ETag}`);
    return uploadResult.ETag;
  } catch (error: any) {
    console.error(`S3 upload failed for Key ${key}:`, error);
    fileStream?.destroy();
    throw new InternalServerError(
      `S3 upload failed: ${error.message || error}`,
    );
  } finally {
    if (fileStream && !fileStream.destroyed) {
      fileStream.destroy();
    }
  }
}

async function updateVideoRecordStatusSafe(
  videoId: string,
  status: VideoStatus,
  objectStorageKey: string | null = null,
): Promise<void> {
  console.log(
    `Attempting SAFE DB update for ${videoId}: Status=${status}, Key=${objectStorageKey ?? 'N/A'}`,
  );
  try {
    const updateData: {
      status: VideoStatus;
      objectStorageKey?: string | null;
    } = { status };
    if (objectStorageKey !== null) {
      updateData.objectStorageKey = objectStorageKey;
    }

    await db.update(videos).set(updateData).where(eq(videos.id, videoId));
    console.log(`DB update successful for video ID: ${videoId}`);
  } catch (error: any) {
    console.error(
      `SAFE Database update failed for video ${videoId} (Status: ${status}):`,
      error,
    );
  }
}

async function cleanupTempFile(filePath: string | undefined): Promise<void> {
  if (!filePath) return;

  try {
    await stat(filePath);
    await unlink(filePath);
    console.log(`Successfully cleaned up temporary file: ${filePath}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`Temporary file already gone or never existed: ${filePath}`);
    } else {
      console.error(`Failed to clean up temporary file ${filePath}:`, error);
    }
  }
}

export const processVideoUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.file) {
    return next(new BadRequestError('No video file data found on request.'));
  }

  const { originalname, mimetype, size, path: sourcePath } = req.file;
  const videoId = uuidv4();
  const fileExtension = extname(originalname);
  const objectStorageKey = `videos/${videoId}${fileExtension}`;

  console.log(
    `Processing Upload: ${originalname} (${mimetype}), Size: ${size}, ID: ${videoId}`,
  );
  console.log(`  Temp Path: ${sourcePath}`);
  console.log(`  Target S3 Key: ${objectStorageKey}`);

  let dbRecordInitiated = false;
  let primaryError: AppError | InternalServerError | Error | null = null;

  try {
    await insertInitialVideoRecord({
      id: videoId,
      originalFilename: originalname,
      mimeType: mimetype,
      sizeBytes: size,
      status: 'PENDING_UPLOAD',
    });
    dbRecordInitiated = true;

    await uploadFileToS3(
      ENV.AWS_S3_BUCKET_NAME,
      objectStorageKey,
      sourcePath,
      mimetype,
    );

    const finalStatus: VideoStatus = 'UPLOADED';
    try {
      await db
        .update(videos)
        .set({
          status: finalStatus,
          objectStorageKey: objectStorageKey,
          uploadedAt: new Date(),
        })
        .where(eq(videos.id, videoId));
      console.log(`Final DB update successful for video ID: ${videoId}`);

      /** Publish event after DB update */
      try {
        const eventPayload = {
          videoId: videoId,
          s3Key: objectStorageKey,
          originalname: originalname,
          mimetype: mimetype,
        };

        const published = await videoEventProducer.publishVideoEvent(
          VIDEO_UPLOAD_COMPLETED_ROUTING_KEY,
          eventPayload,
        );

        if (!published) {
          console.warn(
            `[Controller] Failed to publish video upload event for ${videoId}. Proceeding with response`,
          );
        }
      } catch (eventError: any) {
        console.error(
          `[Controller] Error occured during event publishing for ${videoId}: `,
          eventError,
        );
      }

      res.status(StatusCodes.OK).json({
        message: 'Video uploaded successfully. Event published for processing.',
        videoId: videoId,
        s3Key: objectStorageKey,
      });

      return;
    } catch (dbUpdateError: any) {
      console.error(
        `Database update failed for video ${videoId} after S3 upload:`,
        dbUpdateError,
      );
      primaryError = new InternalServerError(
        `File uploaded but failed to update final status: ${dbUpdateError.message || dbUpdateError}`,
      );
    }
  } catch (error: any) {
    console.error(
      `Error during initial insert or S3 upload for ${videoId}:`,
      error,
    );
    primaryError = error;
  } finally {
    if (primaryError) {
      console.log(
        `Handling error state for video ${videoId}. Primary error: ${primaryError.message}`,
      );
      if (dbRecordInitiated) {
        await updateVideoRecordStatusSafe(videoId, 'UPLOAD_FAILED', null);
      }
      await cleanupTempFile(sourcePath);
      if (
        primaryError instanceof AppError ||
        primaryError instanceof InternalServerError
      ) {
        return next(primaryError);
      } else {
        return next(
          new InternalServerError(
            `Video processing failed: ${primaryError.message || 'Unknown error'}`,
          ),
        );
      }
    } else {
      console.log(
        `Upload process for ${videoId} seemed successful, running final cleanup.`,
      );
      await cleanupTempFile(sourcePath);
    }
  }
};

const getVideoDetailsParamsSchema = z.object({
  videoId: z.string().uuid({ message: 'Invalid video ID format. Expected ID' }),
});

export const getVideoDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const validationResult = getVideoDetailsParamsSchema.safeParse(req.params);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => e.message)
        .join(', ');

      throw new BadRequestError(`Invalid request parameter: ${errorMessages}`);
    }

    const { videoId } = validationResult.data;

    const result = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (result.length === 0) {
      console.log(`Video not found for ID: ${videoId}`);

      throw new NotFoundError(`Video with ID ${videoId} not found.`);
    }

    const videoDetails = result[0];
    console.log(
      `Video found for ID: ${videoId}, Status: ${videoDetails.status}`,
    );

    res.status(StatusCodes.OK).json({
      message: 'Video details retrived successfully',
      data: videoDetails,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return next(error);
    }

    console.error(
      `Unexpected error fetchinf video details for ID ${req.params.videoId}: `,
      error,
    );

    return next(new InternalServerError(`Failed to retrieve video details.`));
  }
};
