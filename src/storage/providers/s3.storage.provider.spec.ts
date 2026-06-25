const mockSend = jest.fn().mockResolvedValue({});
const MockS3Client = jest.fn().mockImplementation(() => ({ send: mockSend }));
const MockPutObjectCommand = jest
  .fn()
  .mockImplementation((input: unknown) => ({ _type: 'PutObject', input }));
const MockDeleteObjectCommand = jest
  .fn()
  .mockImplementation((input: unknown) => ({ _type: 'DeleteObject', input }));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  PutObjectCommand: MockPutObjectCommand,
  DeleteObjectCommand: MockDeleteObjectCommand,
}));

jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomUUID: jest.fn().mockReturnValue('s3-uuid-5678'),
}));

import { ConfigService } from '@nestjs/config';
import { S3StorageProvider } from './s3.storage.provider';

const makeConfig = (overrides: Record<string, string> = {}) => ({
  getOrThrow: jest.fn((key: string) => {
    const defaults: Record<string, string> = {
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      S3_BUCKET: 'my-bucket',
      ...overrides,
    };
    if (!(key in defaults)) throw new Error(`Missing config: ${key}`);
    return defaults[key];
  }),
  get: jest.fn(),
});

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;
  let config: ReturnType<typeof makeConfig>;

  beforeEach(() => {
    jest.clearAllMocks();
    config = makeConfig();
    provider = new S3StorageProvider(config as unknown as ConfigService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('driverName is s3', () => {
    expect(provider.driverName).toBe('s3');
  });

  describe('upload', () => {
    it('sends PutObjectCommand with correct Bucket and Key', async () => {
      await provider.upload('doc.pdf', Buffer.from('data'));

      expect(MockPutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'my-bucket',
          Key: 'tasks/s3-uuid-5678.pdf',
        }),
      );
      expect(mockSend).toHaveBeenCalled();
    });

    it('sets ContentType from file extension', async () => {
      await provider.upload('image.png', Buffer.from('img'));

      expect(MockPutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: 'image/png' }),
      );
    });

    it('falls back to application/octet-stream for unknown extension', async () => {
      await provider.upload('data.zzunknownext', Buffer.from('bin'));

      expect(MockPutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ ContentType: 'application/octet-stream' }),
      );
    });

    it('returns correct storageKey and S3 URL', async () => {
      const result = await provider.upload('file.txt', Buffer.from('text'));

      expect(result.storageKey).toBe('tasks/s3-uuid-5678.txt');
      expect(result.url).toBe(
        'https://my-bucket.s3.us-east-1.amazonaws.com/tasks/s3-uuid-5678.txt',
      );
    });

    it('preserves extension in key', async () => {
      const result = await provider.upload('video.mp4', Buffer.from('vid'));
      expect(result.storageKey).toMatch(/\.mp4$/);
    });

    it('handles file with no extension', async () => {
      const result = await provider.upload('noext', Buffer.from('data'));
      expect(result.storageKey).toBe('tasks/s3-uuid-5678');
    });
  });

  describe('delete', () => {
    it('sends DeleteObjectCommand with correct Bucket and Key', async () => {
      await provider.delete('tasks/some-key.pdf');

      expect(MockDeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'my-bucket',
        Key: 'tasks/some-key.pdf',
      });
      expect(mockSend).toHaveBeenCalled();
    });

    it('swallows S3 errors silently', async () => {
      mockSend.mockRejectedValueOnce(new Error('NoSuchKey'));

      await expect(
        provider.delete('tasks/missing.pdf'),
      ).resolves.toBeUndefined();
    });
  });

  describe('S3Client lazy init', () => {
    it('creates client on first use with correct config', async () => {
      await provider.upload('f.txt', Buffer.from('x'));

      expect(MockS3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
          credentials: {
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
          },
        }),
      );
    });

    it('reuses same client on subsequent calls', async () => {
      await provider.upload('a.txt', Buffer.from('x'));
      await provider.upload('b.txt', Buffer.from('y'));

      expect(MockS3Client).toHaveBeenCalledTimes(1);
    });
  });
});
