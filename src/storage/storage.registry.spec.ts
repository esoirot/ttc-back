import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageRegistry } from './storage.registry';
import { StorageProvider } from './storage-provider.abstract';
import { STORAGE_PROVIDERS } from './storage.constants';

const makeProvider = (name: string): StorageProvider => ({
  driverName: name,
  upload: jest.fn(),
  delete: jest.fn(),
});

describe('StorageRegistry', () => {
  let registry: StorageRegistry;
  const localProvider = makeProvider('local');
  const s3Provider = makeProvider('s3');

  const buildRegistry = async (
    providers: StorageProvider[] = [localProvider, s3Provider],
    storageDriver?: string,
  ) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageRegistry,
        { provide: STORAGE_PROVIDERS, useValue: providers },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(storageDriver) },
        },
      ],
    }).compile();

    const reg = module.get<StorageRegistry>(StorageRegistry);
    reg.onModuleInit();
    return reg;
  };

  describe('onModuleInit', () => {
    it('registers all providers by driverName', async () => {
      registry = await buildRegistry();
      expect(registry.get('local')).toBe(localProvider);
      expect(registry.get('s3')).toBe(s3Provider);
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      registry = await buildRegistry([localProvider, s3Provider], 's3');
    });

    it('returns provider by explicit name', () => {
      expect(registry.get('local')).toBe(localProvider);
    });

    it('uses defaultDriver when no name given', () => {
      expect(registry.get()).toBe(s3Provider);
    });

    it('defaults to local when STORAGE_DRIVER env not set', async () => {
      registry = await buildRegistry([localProvider]);
      expect(registry.get()).toBe(localProvider);
    });

    it('throws when driver not registered', () => {
      expect(() => registry.get('unknown')).toThrow(
        'Storage driver "unknown" not registered',
      );
    });

    it('error message lists available drivers', async () => {
      registry = await buildRegistry([localProvider, s3Provider]);
      expect(() => registry.get('gcs')).toThrow(/local.*s3|s3.*local/);
    });
  });
});
