jest.mock('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { LocalStorageProvider } from './local.storage.provider';

const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(() => {
    provider = new LocalStorageProvider();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('driverName is local', () => {
    expect(provider.driverName).toBe('local');
  });

  describe('upload', () => {
    it('creates upload directory', async () => {
      await provider.upload('file.pdf', Buffer.from('data'));
      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining(join('uploads', 'tasks')),
        { recursive: true },
      );
    });

    it('writes file with UUID-based name', async () => {
      await provider.upload('doc.pdf', Buffer.from('data'));
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('test-uuid-1234.pdf'),
        Buffer.from('data'),
      );
    });

    it('preserves file extension', async () => {
      await provider.upload('image.png', Buffer.from('img'));
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('.png'),
        expect.any(Buffer),
      );
    });

    it('handles file with no extension', async () => {
      await provider.upload('noext', Buffer.from('data'));
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('test-uuid-1234'),
        expect.any(Buffer),
      );
    });

    it('returns storageKey and url as /uploads/tasks/<uuid><ext>', async () => {
      const result = await provider.upload('doc.pdf', Buffer.from('data'));
      expect(result.storageKey).toBe('/uploads/tasks/test-uuid-1234.pdf');
      expect(result.url).toBe('/uploads/tasks/test-uuid-1234.pdf');
    });
  });

  describe('delete', () => {
    it('calls unlink with full file path', async () => {
      await provider.delete('/uploads/tasks/file.pdf');
      expect(mockUnlink).toHaveBeenCalledWith(
        join(process.cwd(), '/uploads/tasks/file.pdf'),
      );
    });

    it('swallows unlink errors silently', async () => {
      mockUnlink.mockRejectedValue(new Error('ENOENT'));
      await expect(
        provider.delete('/uploads/tasks/missing.pdf'),
      ).resolves.toBeUndefined();
    });
  });
});
