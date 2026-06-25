import { encrypt, decrypt } from './crypto.util';

const KEY = 'a'.repeat(64); // 32-byte key as 64-char hex

describe('crypto.util', () => {
  describe('encrypt / decrypt round-trip', () => {
    it('encrypts and decrypts back to original', () => {
      const original = 'secret-api-key-123';
      const ciphertext = encrypt(original, KEY);
      expect(decrypt(ciphertext, KEY)).toBe(original);
    });

    it('produces different ciphertexts for same input (random IV)', () => {
      const a = encrypt('same', KEY);
      const b = encrypt('same', KEY);
      expect(a).not.toBe(b);
    });

    it('ciphertext has iv:enc:tag format', () => {
      const ciphertext = encrypt('hello', KEY);
      const parts = ciphertext.split(':');
      expect(parts).toHaveLength(3);
      parts.forEach((p) => expect(p).toMatch(/^[0-9a-f]+$/));
    });

    it('encrypts empty string', () => {
      const c = encrypt('', KEY);
      expect(decrypt(c, KEY)).toBe('');
    });

    it('encrypts unicode text', () => {
      const text = 'héllo wörld 日本語';
      expect(decrypt(encrypt(text, KEY), KEY)).toBe(text);
    });
  });

  describe('decrypt', () => {
    it('throws on invalid ciphertext format', () => {
      expect(() => decrypt('notvalid', KEY)).toThrow(
        'invalid ciphertext format',
      );
    });

    it('throws on two-part ciphertext', () => {
      expect(() => decrypt('abc:def', KEY)).toThrow(
        'invalid ciphertext format',
      );
    });

    it('throws on tampered ciphertext (bad auth tag)', () => {
      const c = encrypt('original', KEY);
      const [iv, enc, tag] = c.split(':') as [string, string, string];
      const tampered = `${iv}:${enc}:${'0'.repeat(tag.length)}`;
      expect(() => decrypt(tampered, KEY)).toThrow();
    });
  });
});
