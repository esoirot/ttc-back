import { hoursOf, lineAmounts } from './line-amounts';

describe('lineAmounts', () => {
  it('multiplies exactly: 0.15 x 0.359 is 0.0539 (floats give 0.0538)', () => {
    expect(lineAmounts(0.15, 0.359)).toEqual({
      quantity: '0.15',
      unitPrice: '0.359',
      total: '0.0539',
    });
  });

  it('rounds the total half away from zero to 4 decimals', () => {
    expect(lineAmounts(1, 0.00005).total).toBe('0.0001');
    expect(lineAmounts(-1, 0.00005).total).toBe('-0.0001');
    expect(lineAmounts(0.5, 0.0001).total).toBe('0.0001');
    expect(lineAmounts(0.4, 0.0001).total).toBe('0');
    // A discount line: exactly -0.00005 rounds away from zero.
    expect(lineAmounts(-0.5, 0.0001).total).toBe('-0.0001');
    expect(lineAmounts(-0.4, 0.0001).total).toBe('0');
  });

  it('treats values below 1e-6 as 0 and refuses amounts too large to store', () => {
    expect(lineAmounts(1, 1e-7)).toEqual({
      quantity: '1',
      unitPrice: '0',
      total: '0',
    });
    expect(() => lineAmounts(1e21, 1)).toThrow(RangeError);
  });

  it('keeps large amounts exact', () => {
    expect(lineAmounts(1200, 85.75).total).toBe('102900');
    expect(lineAmounts(12345.6789, 9.8765).total).toBe('121932.0977');
  });

  it('rounds quantity and price to the stored 4 decimals first, so total = shown qty x shown price', () => {
    expect(lineAmounts(1 / 3, 60)).toEqual({
      quantity: '0.3333',
      unitPrice: '60',
      total: '19.998',
    });
  });
});

describe('hoursOf', () => {
  it('turns seconds into hours on 4 decimals, rounding exactly', () => {
    expect(hoursOf(540)).toBe(0.15);
    expect(hoursOf(3600)).toBe(1);
    expect(hoursOf(1200)).toBe(0.3333);
    // 0.00005 h is exactly halfway: rounds up
    expect(hoursOf(0.18)).toBe(0.0001);
  });
});
