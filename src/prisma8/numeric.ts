import type { Numeric } from '@prisma/orm-postgres/target/codec-types';

// Prisma 8 reads `numeric` columns as decimal text (read side: `Number(x)`).
// Writes take the same branded text; the precision comes from the column.

const plain = new Intl.NumberFormat('en-US', {
  useGrouping: false,
  maximumFractionDigits: 20,
});

export function toNumeric<P extends number, S extends number>(
  value: number,
): Numeric<P, S>;
export function toNumeric<P extends number, S extends number>(
  value: number | null,
): Numeric<P, S> | null;
export function toNumeric<P extends number, S extends number>(
  value: number | null,
): Numeric<P, S> | null {
  return value === null ? null : (plain.format(value) as Numeric<P, S>);
}
