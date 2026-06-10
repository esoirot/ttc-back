export type StoredFile = { storageKey: string; url: string };

export abstract class StorageProvider {
  abstract readonly driverName: string;
  abstract upload(fileName: string, buffer: Buffer): Promise<StoredFile>;
  abstract delete(storageKey: string): Promise<void>;
}
