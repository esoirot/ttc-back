import { rowFromBackup, rowToBackup } from './db-backup.prisma8';

describe('backup row conversion (Prisma 8)', () => {
  it('writes the Prisma 7 backup format: column names, ISO timestamps, canonical decimals', () => {
    expect(
      rowToBackup('ClientRate', {
        id: 1,
        _type: 'HOURLY',
        amount: '42.5000',
        createdAt: '2026-10-01 10:00:00.123',
        updatedAt: '2026-10-01 10:00:00',
        description: null,
      }),
    ).toEqual({
      id: 1,
      type: 'HOURLY',
      amount: '42.5',
      createdAt: '2026-10-01T10:00:00.123Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
      description: null,
    });
  });

  it('keeps whole decimals without a trailing dot', () => {
    expect(rowToBackup('Client', { taxRate: '20.00' })).toEqual({
      taxRate: '20',
    });
  });

  it('leaves decimals without a fraction and text that looks numeric untouched', () => {
    expect(rowToBackup('ClientRate', { amount: '100', name: 'v2.50' })).toEqual(
      {
        amount: '100',
        name: 'v2.50',
      },
    );
  });

  it('keeps empty timestamps and decimals as null', () => {
    expect(rowToBackup('Client', { contactedAt: null, taxRate: null })).toEqual(
      { contactedAt: null, taxRate: null },
    );
  });

  it('passes through fields the contract does not describe', () => {
    expect(rowToBackup('Client', { extra: 'x' })).toEqual({ extra: 'x' });
    expect(rowFromBackup('Client', { extra: 'x' })).toEqual({ extra: 'x' });
  });

  it('reads a backup row back into Prisma 8 field names', () => {
    expect(
      rowFromBackup('ClientRate', {
        id: 1,
        type: 'HOURLY',
        amount: '42.5',
        createdAt: '2026-10-01T10:00:00.123Z',
      }),
    ).toEqual({
      id: 1,
      _type: 'HOURLY',
      amount: '42.5',
      createdAt: '2026-10-01T10:00:00.123Z',
    });
  });
});
