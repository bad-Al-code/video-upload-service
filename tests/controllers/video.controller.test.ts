import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { StatusCodes } from 'http-status-codes';

vi.mock('../../src/config/env', () => ({
  ENV: {
    AWS_S3_BUCKET_NAME: 'mock-bucket',
    AWS_REGION: 'mock-region',
    AWS_ACCESS_KEY_ID: 'acess-key-id',
    AWS_SECRET_ACCESS_KEY: 'access-secret-access-key',
  },
}));

const mockDb = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db')>();
  return {
    ...actual,
    db: mockDb,
  };
});

const mockS3Client = {
  send: vi.fn(),
};

vi.mock('../../src/config/s3Client', () => ({
  s3Client: mockS3Client,
}));

const mockPutObjectCommand = vi.fn();
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  return {
    ...actual,
    PutObjectCommand: mockPutObjectCommand,
  };
});

const mockFs = {
  createReadStream: vi.fn(),
};

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    createReadStream: mockFs.createReadStream,
  };
});

const mockFsPromises = {
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({}),
};

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    unlink: mockFsPromises.unlink,
    stat: mockFsPromises.stat,
  };
});

const mockUuidv4 = vi.fn();
vi.mock('uuid', () => ({
  v4: mockUuidv4,
}));

const app = (await import('../../src/app')).app;

describe('Video Upload Controller - POST /api/v1/upload/video', () => {
  const agent = request(app);
  const MOCK_VIDEO_ID = 'test-uuid-12345';
  const MOCK_ORIGINAL_FILENAME = 'my-cool-video.mov';
  const MOCK_MIMETYPE = 'video/quicktime';
  const MOCK_FILE_SIZE = 5 * 1024 * 1024;
  const MOCK_S3_KEY = `videos/${MOCK_VIDEO_ID}.mov`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUuidv4.mockReturnValue(MOCK_VIDEO_ID);
    mockDb.values.mockResolvedValue(undefined);
    mockDb.where.mockResolvedValue(undefined);
    mockS3Client.send.mockResolvedValue({ ETag: 'mock-etag-value' });
    mockFs.createReadStream.mockReturnValue(
      Readable.from(['mock stream data']),
    );
    mockFsPromises.unlink.mockResolvedValue(undefined);
    mockFsPromises.stat.mockResolvedValue({});
    mockPutObjectCommand.mockClear();
  });

  it('should return 400 Bad Request if no file is provided', async () => {
    const response = await agent.post('/api/v1/upload/video').send({});
    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.message).toContain('No video file data found');
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockS3Client.send).not.toHaveBeenCalled();
  });

  it('should process successful upload, returning 200 OK with videoId and s3Key', async () => {
    const fileContent = Buffer.from('this is dummy video content');

    const response = await agent
      .post('/api/v1/upload/video')
      .attach('videoFile', fileContent, {
        filename: MOCK_ORIGINAL_FILENAME,
        contentType: MOCK_MIMETYPE,
      });

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body).toEqual({
      message: expect.stringContaining('uploaded successfully'),
      videoId: MOCK_VIDEO_ID,
      s3Key: MOCK_S3_KEY,
    });

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockDb.values).toHaveBeenCalledOnce();
    expect(mockDb.values).toHaveBeenCalledWith({
      id: MOCK_VIDEO_ID,
      originalFilename: MOCK_ORIGINAL_FILENAME,
      mimeType: MOCK_MIMETYPE,
      sizeBytes: fileContent.length,
      status: 'PENDING_UPLOAD',
    });

    expect(mockS3Client.send).toHaveBeenCalledOnce();
    expect(mockPutObjectCommand).toHaveBeenCalledOnce();
    expect(mockPutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'mock-bucket',
      Key: MOCK_S3_KEY,
      Body: expect.any(Readable),
      ContentType: MOCK_MIMETYPE,
    });

    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(mockDb.set).toHaveBeenCalledOnce();
    expect(mockDb.set).toHaveBeenCalledWith({
      status: 'PROCESSING',
      objectStorageKey: MOCK_S3_KEY,
    });

    expect(mockFsPromises.stat).toHaveBeenCalledOnce();
    expect(mockFsPromises.unlink).toHaveBeenCalledOnce();
  });

  it('should return 500 Internal Server Error if initial DB insert fails', async () => {
    const dbError = new Error('Initial DB insert connection error');
    mockDb.values.mockRejectedValueOnce(dbError);

    const response = await agent
      .post('/api/v1/upload/video')
      .attach('videoFile', Buffer.from('content'), MOCK_ORIGINAL_FILENAME);

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.body.message).toMatch(/Database insert failed/i);

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockDb.values).toHaveBeenCalledOnce();
    expect(mockS3Client.send).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockFsPromises.stat).toHaveBeenCalledOnce();
    expect(mockFsPromises.unlink).toHaveBeenCalledOnce();
  });

  it('should return 500 Internal Server Error if S3 upload fails and update DB status', async () => {
    const s3Error = new Error('S3 upload network error');
    mockS3Client.send.mockRejectedValueOnce(s3Error);

    const response = await agent
      .post('/api/v1/upload/video')
      .attach('videoFile', Buffer.from('content'), MOCK_ORIGINAL_FILENAME);

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.body.message).toMatch(/S3 upload failed/i);

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockDb.values).toHaveBeenCalledOnce();
    expect(mockS3Client.send).toHaveBeenCalledOnce();
    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(mockDb.set).toHaveBeenCalledOnce();
    expect(mockDb.set).toHaveBeenCalledWith({ status: 'UPLOAD_FAILED' });

    expect(mockFsPromises.stat).toHaveBeenCalledOnce();
    expect(mockFsPromises.unlink).toHaveBeenCalledOnce();
  });

  it('should return 500 Internal Server Error if DB update after S3 success fails', async () => {
    const dbUpdateError = new Error('DB update connection error after S3');
    mockS3Client.send.mockResolvedValue({ ETag: 'mock-etag-value' });
    mockDb.where.mockRejectedValueOnce(dbUpdateError);

    const response = await agent
      .post('/api/v1/upload/video')
      .attach('videoFile', Buffer.from('content'), MOCK_ORIGINAL_FILENAME);

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.body.message).toMatch(
      /DB update connection error after S3/i,
    );

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockS3Client.send).toHaveBeenCalledOnce();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith({
      status: 'PROCESSING',
      objectStorageKey: MOCK_S3_KEY,
    });

    mockDb.where.mockResolvedValue(undefined);
    await vi.waitFor(() => {
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });
    expect(mockDb.set).toHaveBeenNthCalledWith(2, { status: 'UPLOAD_FAILED' });

    expect(mockFsPromises.stat).toHaveBeenCalledOnce();
    expect(mockFsPromises.unlink).toHaveBeenCalledOnce();
  });
});
