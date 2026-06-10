import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageProvider } from './storage-provider.abstract';
import { StorageRegistry } from './storage.registry';
import { STORAGE_PROVIDERS } from './storage.constants';
import { LocalStorageProvider } from './providers/local.storage.provider';
import { S3StorageProvider } from './providers/s3.storage.provider';

@Module({})
export class StorageModule {
  static register(): DynamicModule {
    const providerClasses = [LocalStorageProvider, S3StorageProvider];

    return {
      module: StorageModule,
      imports: [ConfigModule],
      providers: [
        ...providerClasses,
        {
          provide: STORAGE_PROVIDERS,
          useFactory: (...instances: StorageProvider[]) => instances,
          inject: providerClasses,
        },
        StorageRegistry,
      ],
      exports: [StorageRegistry],
    };
  }
}
