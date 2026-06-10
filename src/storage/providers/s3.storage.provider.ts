import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import mime from 'mime-types';
import { StorageProvider, StoredFile } from '../storage-provider.abstract';

@Injectable()
export class S3StorageProvider extends StorageProvider {
  readonly driverName = 's3';

  private _client: S3Client | null = null;
  private readonly config: ConfigService;

  constructor(config: ConfigService) {
    super();
    this.config = config;
  }

  private get client(): S3Client {
    if (!this._client) {
      this._client = new S3Client({
        region: this.config.getOrThrow<string>('AWS_REGION'),
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.config.getOrThrow<string>(
            'AWS_SECRET_ACCESS_KEY',
          ),
        },
      });
    }
    return this._client;
  }

  private get bucket(): string {
    return this.config.getOrThrow<string>('S3_BUCKET');
  }

  private get region(): string {
    return this.config.getOrThrow<string>('AWS_REGION');
  }

  async upload(fileName: string, buffer: Buffer): Promise<StoredFile> {
    const ext = extname(fileName) || '';
    const key = `tasks/${randomUUID()}${ext}`;
    const contentType =
      (mime.lookup(fileName) || undefined) ?? 'application/octet-stream';

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    return { storageKey: key, url };
  }

  async delete(storageKey: string): Promise<void> {
    await this.client
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }))
      .catch(() => undefined);
  }
}
