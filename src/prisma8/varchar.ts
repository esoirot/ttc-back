import type { Varchar } from '@prisma/orm-postgres/target/codec-types';

/** Brands text for a `varchar(n)` column; Postgres still enforces the length. */
export function toVarchar<N extends number>(value: string): Varchar<N>;
export function toVarchar<N extends number>(
  value: string | null,
): Varchar<N> | null;
export function toVarchar<N extends number>(
  value: string | undefined,
): Varchar<N> | undefined;
export function toVarchar<N extends number>(
  value: string | null | undefined,
): Varchar<N> | null | undefined {
  return value as Varchar<N> | null | undefined;
}
