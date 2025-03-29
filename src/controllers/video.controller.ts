import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { extname, join } from 'node:path';
import { unlink } from 'node:fs/promises';
import * as fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { PutObjectCommand } from '@aws-sdk/client-s3';

import { BadRequestError, InternalServerError } from '../errors';
import { db, schema } from '../db';
import { s3Client } from '../config/s3Client'; // Import the configured S3 client
import { ENV } from '../config/env'; // Import ENV for bucket name

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
    path: sourcePath /* Multer's temp path */,
  } = req.file;
  const videoId = uuidv4();
  // Define the S3 Key (path within the bucket)
  // Example: videos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.mp4
  const fileExtension = extname(originalname);
  const objectStorageKey = `videos/${videoId}${fileExtension}`;

  console.log(`Received file: ${originalname} (${mimetype}), Size: ${size}`);
  console.log(`Generated Video ID: ${videoId}`);
  console.log(`Multer temp path: ${sourcePath}`);
  console.log(`Target S3 Key: ${objectStorageKey}`);

  // --- Step 1: Create initial DB record ---
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
    // Try cleanup multer file even if DB fails
    try {
      await unlink(sourcePath);
    } catch (e) {
      console.error(`Failed cleanup ${sourcePath} after DB insert fail`, e);
    }
    return next(
      new InternalServerError('Failed to initiate video record in database.'),
    );
  }

  // --- Step 2: Upload file to S3 ---
  try {
    console.log(
      `Attempting to upload to S3: Bucket=${ENV.AWS_S3_BUCKET_NAME}, Key=${objectStorageKey}`,
    );

    // Create a readable stream from the temporary file
    const fileStream = fs.createReadStream(sourcePath);

    // Prepare the S3 PutObject command
    const command = new PutObjectCommand({
      Bucket: ENV.AWS_S3_BUCKET_NAME,
      Key: objectStorageKey,
      Body: fileStream,
      ContentType: mimetype,
      // Optional: Add metadata
      // Metadata: {
      //     'original-filename': originalname // S3 metadata keys are often lowercase
      // }
    });

    // Send the command to S3
    const uploadResult = await s3Client.send(command);
    console.log(`Successfully uploaded to S3. ETag: ${uploadResult.ETag}`); // ETag confirms success

    // --- Step 3: Update DB status and add S3 key ---
    try {
      console.log(`Updating DB record for ${videoId} with S3 key and status.`);
      await db
        .update(videos)
        .set({
          status: 'PROCESSING', // Or 'UPLOADED' - processing starts next
          objectStorageKey: objectStorageKey,
        })
        .where(eq(videos.id, videoId));
      console.log(`Successfully updated DB for video ID: ${videoId}`);

      // --- Step 4: Cleanup local temp file (ONLY after successful S3 upload and DB update) ---
      try {
        await unlink(sourcePath);
        console.log(`Successfully cleaned up temporary file: ${sourcePath}`);
      } catch (cleanupError: any) {
        // Log this, but don't fail the request - S3 upload succeeded.
        console.error(
          `Failed to clean up temporary file ${sourcePath} after successful upload:`,
          cleanupError,
        );
      }

      // --- Success Response ---
      res.status(StatusCodes.OK).json({
        message: 'Video uploaded to S3 successfully. Processing initiated.',
        videoId: videoId,
        s3Key: objectStorageKey,
      });
    } catch (dbUpdateError: any) {
      console.error(
        `Database update failed for video ${videoId} after S3 upload:`,
        dbUpdateError,
      );
      // Critical state: File in S3, but DB not updated. May need retry or manual fix.
      // For now, log and return error. Consider cleanup of S3 object if needed.
      return next(
        new InternalServerError(
          'File uploaded but failed to update video status in database.',
        ),
      );
    }
  } catch (s3Error: any) {
    console.error(
      `Failed to upload file to S3 (Bucket: ${ENV.AWS_S3_BUCKET_NAME}, Key: ${objectStorageKey}):`,
      s3Error,
    );

    // --- Step 3b: Update DB status on S3 failure ---
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
        `Failed to update DB status to FAILED for video ${videoId} after S3 upload error:`,
        dbFailError,
      );
    }

    // Attempt cleanup of the original multer file even on S3 failure
    try {
      await unlink(sourcePath);
      console.log(`Cleaned up intermediate file ${sourcePath} after S3 error.`);
    } catch (cleanupError: any) {
      console.error(
        `Failed to cleanup intermediate file ${sourcePath} after S3 error:`,
        cleanupError,
      );
    }

    return next(
      new InternalServerError('Failed to upload video file to storage.'),
    );
  }
};
