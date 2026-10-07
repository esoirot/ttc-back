import { buildDumpFilename, toPgDumpUrl } from './pg-dump.core';

describe('buildDumpFilename', () => {
  it('produces a sortable pg-dump .dump name the JSON backup rotation never matches', () => {
    const name = buildDumpFilename(new Date('2026-10-07T08:15:30.123Z'));
    expect(name).toBe('pg-dump-2026-10-07T08-15-30-123Z.dump');
    expect(name).not.toMatch(/^db-backup-.*\.json$/);
  });
});

describe('toPgDumpUrl', () => {
  it('drops the Prisma-only schema param, which pg_dump rejects', () => {
    expect(
      toPgDumpUrl('postgresql://u:p@localhost:5432/ttc?schema=public'),
    ).toBe('postgresql://u:p@localhost:5432/ttc');
  });

  it('keeps libpq params such as sslmode', () => {
    expect(
      toPgDumpUrl(
        'postgresql://u:p@db.example.com:5432/ttc?schema=public&sslmode=require',
      ),
    ).toBe('postgresql://u:p@db.example.com:5432/ttc?sslmode=require');
  });

  it('leaves a URL without params unchanged', () => {
    expect(
      toPgDumpUrl('postgresql://u:p@localhost:51214/ttc-postgres-db'),
    ).toBe('postgresql://u:p@localhost:51214/ttc-postgres-db');
  });
});
