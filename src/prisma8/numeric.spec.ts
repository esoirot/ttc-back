import { toNumeric } from './numeric';

describe('toNumeric', () => {
  it('writes a number as decimal text Postgres parses exactly', () => {
    expect(toNumeric(42.5)).toBe('42.5');
    expect(toNumeric(0.000001)).toBe('0.000001');
    expect(toNumeric(1e-7)).toBe('0.0000001');
  });

  it('passes null through for optional columns', () => {
    expect(toNumeric(null)).toBeNull();
  });
});
