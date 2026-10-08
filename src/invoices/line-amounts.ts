import type { Numeric } from '@prisma/orm-postgres/target/codec-types';

// Invoice amounts are numeric(10, 4): computed here in exact decimal
// (integers of 1/10000), never in binary floating point, where e.g.
// 0.15 * 0.359 = 0.053849999... rounds to 0.0538 instead of 0.0539.

const SCALE = 10_000n;

/** Integer division rounding half away from zero. */
function divRound(n: bigint, d: bigint): bigint {
  const q = n / d;
  const twiceRest = 2n * (n % d);
  if (twiceRest >= d) return q + 1n;
  if (twiceRest <= -d) return q - 1n;
  return q;
}

/** The decimal the number was written as, in 1/10000 units. */
function units(value: number): bigint {
  const text = String(value);
  if (text.includes('e')) {
    if (Math.abs(value) < 1) return 0n; // below 1e-6: rounds to 0
    throw new RangeError(`Amount out of range: ${value}`);
  }
  const negative = text.startsWith('-');
  const [int, frac = ''] = text.replace('-', '').split('.');
  const digits = BigInt(int + frac);
  const exact = digits * SCALE;
  const scaled = divRound(exact, 10n ** BigInt(frac.length));
  return negative ? -scaled : scaled;
}

function text(u: bigint): string {
  const negative = u < 0n;
  const abs = negative ? -u : u;
  const int = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(4, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}

/** Quantity, price and their product as stored (4 decimals, exact). */
export function lineAmounts(quantity: number, unitPrice: number) {
  const q = units(quantity);
  const p = units(unitPrice);
  return {
    quantity: text(q) as Numeric<10, 4>,
    unitPrice: text(p) as Numeric<10, 4>,
    total: text(divRound(q * p, SCALE)) as Numeric<10, 4>,
  };
}

/** Billable hours of a duration, on the 4 decimals an invoice line keeps. */
export function hoursOf(seconds: number): number {
  return Number(text(divRound(units(seconds), 3600n)));
}
