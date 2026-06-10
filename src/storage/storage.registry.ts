import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage-provider.abstract';
import { STORAGE_PROVIDERS } from './storage.constants';

@Injectable()
export class StorageRegistry implements OnModuleInit {
  private readonly map = new Map<string, StorageProvider>();
  private readonly defaultDriver: string;

  constructor(
    @Inject(STORAGE_PROVIDERS) private readonly providers: StorageProvider[],
    private readonly config: ConfigService,
  ) {
    this.defaultDriver = config.get<string>('STORAGE_DRIVER') ?? 'local';
  }

  onModuleInit(): void {
    for (const p of this.providers) {
      this.map.set(p.driverName, p);
    }
  }

  get(driver?: string): StorageProvider {
    const name = driver ?? this.defaultDriver;
    const p = this.map.get(name);
    if (!p) {
      throw new Error(
        `Storage driver "${name}" not registered. Available: ${[...this.map.keys()].join(', ')}`,
      );
    }
    return p;
  }
}
