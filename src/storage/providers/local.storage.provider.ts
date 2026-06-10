import { Injectable } from '@nestjs/common';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StorageProvider, StoredFile } from '../storage-provider.abstract';

@Injectable()
export class LocalStorageProvider extends StorageProvider {
  readonly driverName = 'local';

  async upload(fileName: string, buffer: Buffer): Promise<StoredFile> {
    const ext = extname(fileName) || '';
    const uniqueName = `${randomUUID()}${ext}`;
    const uploadDir = join(process.cwd(), 'uploads', 'tasks');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, uniqueName), buffer);
    const storageKey = `/uploads/tasks/${uniqueName}`;
    return { storageKey, url: storageKey };
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = join(process.cwd(), storageKey);
    await unlink(filePath).catch(() => undefined);
  }
}
