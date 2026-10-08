import { fromDb } from '../../prisma8/timestamp';

/** A Prisma 8 Occupation row with its timestamps back to Date. */
export function occupationFromDb<
  R extends { createdAt: string; updatedAt: string },
>(
  row: R,
): Omit<R, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date } {
  return {
    ...row,
    createdAt: fromDb(row.createdAt),
    updatedAt: fromDb(row.updatedAt),
  };
}
