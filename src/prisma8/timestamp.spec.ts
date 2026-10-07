import { fromDb, toDb } from './timestamp';

describe('timestamp codec', () => {
  it('reads Postgres timestamp text as the UTC instant Prisma 7 wrote', () => {
    expect(fromDb('2026-10-07 08:15:30.123')).toEqual(
      new Date('2026-10-07T08:15:30.123Z'),
    );
  });

  it('reads values without fractional seconds', () => {
    expect(fromDb('2026-10-07 08:15:30')).toEqual(
      new Date('2026-10-07T08:15:30.000Z'),
    );
  });

  it('passes null through for optional columns', () => {
    expect(fromDb(null)).toBeNull();
    expect(toDb(null)).toBeNull();
  });

  it('writes a Date as UTC wall-clock text, round-tripping to the same instant', () => {
    const date = new Date('2026-10-07T08:15:30.123Z');
    expect(toDb(date)).toBe('2026-10-07 08:15:30.123');
    expect(fromDb(toDb(date))).toEqual(date);
  });
});
