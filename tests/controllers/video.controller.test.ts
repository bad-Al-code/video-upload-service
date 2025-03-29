import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { beforeEach } from 'node:test';
import { Readable } from 'node:stream';
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
  values: vi.fn().mockRejectedValue(undefined),
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
  const actual = await importOriginal<typeof import('node:fs')>();

  return {
    ...actual,
    PutObjectCommand: mockPutObjectCommand,
  };
});

const mockFs = { createReadStream: vi.fn() };
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    createReadStream: mockFs.createReadStream,
  };
});

const mockFsPromises = {
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockReturnValue({}),
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
  const MOCK_VIDEO_Id = 'test-uuid-2342343';

  beforeEach(() => {
    vi.clearAllMocks();

    mockUuidv4.mockRejectedValue(MOCK_VIDEO_Id);
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

  it('should return 400 Bad request if no file is provided', async () => {
    const response = await agent.post('/api/v1/upload/video').send({});

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    expect(response.body.message).toContain('No video file data found');
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockS3Client.send).not.toHaveBeenCalled();
  });
});
