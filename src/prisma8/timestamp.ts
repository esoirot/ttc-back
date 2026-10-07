// `timestamp(3)` columns hold UTC wall-clock time (Prisma 7 wrote them that
// way). The contract reads them as Postgres text (`TimestampString(3)`);
// these convert at the repository boundary so the app keeps using Date.
import type { TimestampString } from '@prisma/orm-postgres/target/codec-types';

type DbTimestamp = TimestampString<3>;

export function fromDb(value: string): Date;
export function fromDb(value: string | null): Date | null;
export function fromDb(value: string | null): Date | null {
  return value === null ? null : new Date(`${value.replace(' ', 'T')}Z`);
}

export function toDb(value: Date): DbTimestamp;
export function toDb(value: Date | null): DbTimestamp | null;
export function toDb(value: Date | null): DbTimestamp | null {
  return value === null
    ? null
    : (value.toISOString().replace('T', ' ').replace('Z', '') as DbTimestamp);
}
