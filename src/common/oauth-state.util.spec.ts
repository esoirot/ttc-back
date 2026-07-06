import { BadRequestException } from '@nestjs/common';
import { signOAuthState, verifyOAuthState } from './oauth-state.util';

describe('oauth-state.util', () => {
  const secret = 'test-secret';

  describe('sign + verify round trip', () => {
    it('returns the original payload fields plus nonce/exp', () => {
      const state = signOAuthState(secret, { userId: 42 }, 60_000);
      const result = verifyOAuthState<{ userId: number }>(secret, state);

      expect(result.userId).toBe(42);
      expect(typeof result.exp).toBe('number');
    });

    it('supports an empty payload (no extra fields)', () => {
      const state = signOAuthState(secret, {}, 60_000);
      const result = verifyOAuthState(secret, state);

      expect(typeof result.exp).toBe('number');
    });
  });

  describe('verifyOAuthState', () => {
    it('throws BadRequestException for invalid base64/JSON', () => {
      expect(() => verifyOAuthState(secret, 'not-valid-base64!!')).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the signature is tampered', () => {
      const state = signOAuthState(secret, { userId: 1 }, 60_000);
      const parsed = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as { payload: string; sig: string };
      parsed.sig = 'a'.repeat(64);
      const tampered = Buffer.from(JSON.stringify(parsed)).toString(
        'base64url',
      );

      expect(() => verifyOAuthState(secret, tampered)).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when signed with a different secret', () => {
      const state = signOAuthState('wrong-secret', { userId: 1 }, 60_000);
      expect(() => verifyOAuthState(secret, state)).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when expired', () => {
      const state = signOAuthState(secret, { userId: 1 }, -1);
      expect(() => verifyOAuthState(secret, state)).toThrow(
        'OAuth state expired',
      );
    });
  });
});
