import { buildBackupFilename, selectFilesToDelete } from './db-backup.core';

describe('buildBackupFilename', () => {
  it('produces a sortable, backup-prefixed .json name', () => {
    const name = buildBackupFilename(new Date('2026-07-09T02:00:00.000Z'));
    expect(name).toBe('db-backup-2026-07-09T02-00-00-000Z.json');
  });
});

describe('selectFilesToDelete', () => {
  const backups = [
    'db-backup-2026-07-01T02-00-00-000Z.json',
    'db-backup-2026-07-02T02-00-00-000Z.json',
    'db-backup-2026-07-03T02-00-00-000Z.json',
    'db-backup-2026-07-04T02-00-00-000Z.json',
    'db-backup-2026-07-05T02-00-00-000Z.json',
    'db-backup-2026-07-06T02-00-00-000Z.json',
  ];

  it('returns the oldest files beyond maxKept, keeping the newest N', () => {
    expect(selectFilesToDelete(backups, 5)).toEqual([
      'db-backup-2026-07-01T02-00-00-000Z.json',
    ]);
  });

  it('no-ops when count is at or below maxKept', () => {
    expect(selectFilesToDelete(backups.slice(0, 5), 5)).toEqual([]);
    expect(selectFilesToDelete(backups.slice(0, 3), 5)).toEqual([]);
  });

  it('ignores files that are not db-backup-*.json', () => {
    const withNoise = [
      ...backups,
      'README.md',
      'db-backup-corrupt.txt',
      '.gitkeep',
    ];
    expect(selectFilesToDelete(withNoise, 5)).toEqual([
      'db-backup-2026-07-01T02-00-00-000Z.json',
    ]);
  });

  it('is order-independent (sorts input before selecting)', () => {
    const shuffled = [...backups].reverse();
    expect(selectFilesToDelete(shuffled, 5)).toEqual([
      'db-backup-2026-07-01T02-00-00-000Z.json',
    ]);
  });
});
