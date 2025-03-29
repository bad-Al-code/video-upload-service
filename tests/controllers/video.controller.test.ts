import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { StatusCodes } from 'http-status-codes';

vi.mock('../../src/config/env', () => ({
  ENV: {
    AWS_S3_BUCKET_NAME: 'mock-bucket',
    AWS_REGION: 'mock-region',
    AWS_ACCESS_KEY_ID: 'mock-key-id',
    AWS_SECRET_ACCESS_KEY: 'mock-secret',
  },
}));

const mockDb = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
  limit: vi.fn().mockResolvedValue([]),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
};
vi.mock('../../src/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db')>();
  return {
    ...actual,
    db: mockDb,
    schema: {
      videos: {
        id: 'videos.id',
        status: 'videos.status',
        objectStorageKey: 'videos.objectStorageKey',
      },
      videoStatuses: [
        'PENDING_UPLOAD',
        'UPLOAD_FAILED',
        'PROCESSING',
        'READY',
        'ERROR',
      ],
    },
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
  const MOCK_FILE_CONTENT = Buffer.from('this is dummy video content');
  const MOCK_FILE_SIZE = MOCK_FILE_CONTENT.length;
  const MOCK_S3_KEY = `videos/${MOCK_VIDEO_ID}.mov`;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUuidv4.mockReturnValue(MOCK_VIDEO_ID);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReset().mockResolvedValue(undefined);
    mockDb.update.mockReturnThis();
    mockDb.set.mockReset().mockReturnThis();
    mockDb.where.mockReset().mockResolvedValue(undefined);
    mockS3Client.send
      .mockReset()
      .mockResolvedValue({ ETag: 'mock-etag-value' });
    mockFs.createReadStream
      .mockReset()
      .mockReturnValue(Readable.from([MOCK_FILE_CONTENT]));
    mockFsPromises.unlink.mockReset().mockResolvedValue(undefined);
    mockFsPromises.stat.mockReset().mockResolvedValue({});
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
    const response = await agent
      .post('/api/v1/upload/video')
      .attach('videoFile', MOCK_FILE_CONTENT, {
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
      orignalFilename: MOCK_ORIGINAL_FILENAME,
      mimeType: MOCK_MIMETYPE,
      sizeBytes: expect.any(Number),
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
      .attach('videoFile', MOCK_FILE_CONTENT, MOCK_ORIGINAL_FILENAME);

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.body.message).toMatch(/Database insert failed/i);
    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockDb.values).toHaveBeenCalledOnce();
    expect(mockS3Client.send).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockFsPromises.unlink).toHaveBeenCalledOnce();
  });

  it('should return 500 Internal Server Error if S3 upload fails and update DB status', async () => {
    const s3Error = new Error('S3 upload network error');
    mockS3Client.send.mockRejectedValueOnce(s3Error);

    const response = await agent
      .post('/api/v1/upload/video')
      .attach('videoFile', MOCK_FILE_CONTENT, MOCK_ORIGINAL_FILENAME);

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.body.message).toMatch(/S3 upload failed/i);
    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockS3Client.send).toHaveBeenCalledOnce();
    expect(mockDb.update).toHaveBeenCalledOnce();
    expect(mockDb.set).toHaveBeenCalledOnce();
    expect(mockDb.set).toHaveBeenCalledWith({ status: 'UPLOAD_FAILED' });
    expect(mockFsPromises.unlink).toHaveBeenCalledOnce();
  });

  it('should return 500 Internal Server Error if final DB update fails after S3 success', async () => {
    const dbUpdateError = new Error('DB update connection error after S3');
    mockS3Client.send.mockResolvedValue({ ETag: 'mock-etag-value' });
    mockDb.where.mockImplementationOnce(() => {
      throw dbUpdateError;
    });

    const response = await agent
      .post('/api/v1/upload/video')
      .attach('videoFile', MOCK_FILE_CONTENT, MOCK_ORIGINAL_FILENAME);

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.body.message).toMatch(/failed to update final status/i);
    expect(response.body.message).toContain(
      'DB update connection error after S3',
    );

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockS3Client.send).toHaveBeenCalledOnce();

    expect(mockDb.update).toHaveBeenCalledTimes(2);
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

describe('Video Details Controller - GET /api/v1/upload/videos/:videoId', () => {
  const agent = request(app);
  const MOCK_VALID_UUID = '26a42e24-1d4e-4679-875d-9ed80a0d43da';
  const MOCK_OTHER_UUID = 'ea6f2864-1b28-4c45-8cd3-d9b892b01a59';
  const MOCK_INVALID_ID_FORMAT = 'dummy-id';
  const MOCK_VIDEO_DATA = {
    id: MOCK_VALID_UUID,
    orignalFilename: 'found-video.mp4',
    mimeType: 'video/mp4',
    sizeByte: 3398683,
    status: 'READY',
    title: 'Found Video Title',
    description: 'A video description',
    durationSeconds: 120,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.select.mockClear().mockReturnThis();
    mockDb.from.mockClear().mockReturnThis();
    mockDb.where.mockClear().mockReturnThis();
    mockDb.limit.mockClear().mockResolvedValue([]);
  });

  it('should return 400 Bad Request if videoId is not a valid UUID', async () => {
    const response = await agent.get(
      `/api/v1/upload/videos/${MOCK_INVALID_ID_FORMAT}`,
    );

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.message).toMatch(/invalid request parameter/i);
    expect(response.body.message).toMatch(/invalid video id format/i);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('should return 404 Not Found if video with valid UUID does not exist', async () => {
    mockDb.limit.mockResolvedValueOnce([]);

    const response = await agent.get(
      `/api/v1/upload/videos/${MOCK_OTHER_UUID}`,
    );

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
    expect(response.body.message).toContain('Video with ID');
    expect(response.body.message).toContain('not found');

    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(mockDb.where).toHaveBeenCalledOnce();
    expect(mockDb.limit).toHaveBeenCalledOnce();
  });

  it('should return 200 OK with video details if video exists', async () => {
    const mockDataWithISODates = {
      ...MOCK_VIDEO_DATA,
      createdAt: new Date(MOCK_VIDEO_DATA.createdAt),
      updatedAt: new Date(MOCK_VIDEO_DATA.updatedAt),
    };

    mockDb.limit.mockResolvedValueOnce([mockDataWithISODates]);

    const response = await agent.get(
      `/api/v1/upload/videos/${MOCK_VALID_UUID}`,
    );

    expect(response.status).toBe(StatusCodes.OK);
    expect(response.body.message).toContain(
      'Video details retrived successfully',
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        ...MOCK_VIDEO_DATA,
        createdAt: MOCK_VIDEO_DATA.createdAt,
        updatedAt: MOCK_VIDEO_DATA.updatedAt,
      }),
    );

    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(mockDb.where).toHaveBeenCalledOnce();
    expect(mockDb.limit).toHaveBeenCalledOnce();
  });

  it('should return 500 Internal Server Error if database query fails', async () => {
    const dbQueryError = new Error('Unexpected DB connection error');
    mockDb.limit.mockRejectedValueOnce(dbQueryError);

    const response = await agent.get(
      `/api/v1/upload/videos/${MOCK_VALID_UUID}`,
    );

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(response.body.message).toContain('Failed to retrieve video details');

    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(mockDb.where).toHaveBeenCalledOnce();
    expect(mockDb.limit).toHaveBeenCalledOnce();
  });
});
