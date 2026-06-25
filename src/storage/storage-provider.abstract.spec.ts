import { StorageProvider, StoredFile } from './storage-provider.abstract';

class ConcreteProvider extends StorageProvider {
  readonly driverName = 'test';
  upload(_fileName: string, _buffer: Buffer): Promise<StoredFile> {
    return Promise.resolve({ storageKey: 'key', url: '/key' });
  }
  delete(_storageKey: string): Promise<void> {
    return Promise.resolve();
  }
}

describe('StorageProvider (abstract)', () => {
  let provider: ConcreteProvider;

  beforeEach(() => {
    provider = new ConcreteProvider();
  });

  it('can be instantiated via concrete subclass', () => {
    expect(provider).toBeDefined();
  });

  it('exposes driverName', () => {
    expect(provider.driverName).toBe('test');
  });

  it('upload returns StoredFile shape', async () => {
    const result = await provider.upload('file.txt', Buffer.from('data'));
    expect(result).toHaveProperty('storageKey');
    expect(result).toHaveProperty('url');
  });

  it('delete resolves without error', async () => {
    await expect(provider.delete('key')).resolves.toBeUndefined();
  });
});
