import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { extname } from 'node:path';
import { unlink, stat } from 'node:fs/promises';
import * as fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { PutObjectCommand } from '@aws-sdk/client-s3';

import { BadRequestError, InternalServerError, AppError } from '../errors';
import { db, schema } from '../db';
import { s3Client } from '../config/s3Client';
import { ENV } from '../config/env';
import { createReadStream } from 'node:fs';

const { videos } = schema;
type VideoStatus = (typeof schema.videoStatus)[number];

async function insertInitialVideoRecord(videoData: {
  id: string;
  orignalFilename: string;
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
    fileStream = createReadStream(filePath);
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
    throw new InternalServerError(
      `S3 upload failed: ${error.message || error}`,
    );
  } finally {
    fileStream?.destroy();
  }
}

async function updateVideoRecord(
  videoId: string,
  status: VideoStatus,
  objectStorageKey: string | null = null,
): Promise<void> {
  console.log(
    `Attempting DB update for ${videoId}: Status=${status}, Key=${objectStorageKey ?? 'N/A'}`,
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
    console.error(`Database update failed for video ${videoId}:`, error);
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

  try {
    await insertInitialVideoRecord({
      id: videoId,
      orignalFilename: originalname,
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

    await updateVideoRecord(videoId, 'PROCESSING', objectStorageKey);

    res.status(StatusCodes.OK).json({
      message: 'Video uploaded successfully. Processing initiated.',
      videoId: videoId,
      s3Key: objectStorageKey,
    });
  } catch (error: any) {
    console.error(`Error processing video upload for ${videoId}:`, error);

    if (dbRecordInitiated) {
      await updateVideoRecord(videoId, 'UPLOAD_FAILED', null);
    }

    if (error instanceof AppError) {
      return next(error);
    } else {
      return next(
        new InternalServerError(
          `Video processing failed: ${error.message || 'Unknown error'}`,
        ),
      );
    }
  } finally {
    await cleanupTempFile(sourcePath);
  }
};
