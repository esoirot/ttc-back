import { containsPattern } from './like';

describe('containsPattern', () => {
  it('wraps the text for a contains match', () => {
    expect(containsPattern('acme')).toBe('%acme%');
  });

  it('escapes LIKE wildcards and the escape character so they match literally', () => {
    expect(containsPattern('100%')).toBe('%100\\%%');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
    expect(containsPattern('c:\\dir')).toBe('%c:\\\\dir%');
  });
});
