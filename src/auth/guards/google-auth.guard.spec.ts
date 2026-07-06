import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleInitiateGuard, GoogleCallbackGuard } from './google-auth.guard';
import { signOAuthState } from '../../common/oauth-state.util';

const JWT_SECRET = 'test-jwt-secret';

const makeConfig = () =>
  ({
    getOrThrow: jest.fn().mockReturnValue(JWT_SECRET),
  }) as unknown as ConfigService;

const makeContext = (query: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ query }),
    }),
  }) as unknown as ExecutionContext;

describe('GoogleInitiateGuard', () => {
  it('returns a signed state string in authenticate options', () => {
    const guard = new GoogleInitiateGuard(makeConfig());
    const options = guard.getAuthenticateOptions();

    expect(typeof options.state).toBe('string');
    expect(options.state.length).toBeGreaterThan(0);
  });
});

describe('GoogleCallbackGuard', () => {
  let superCanActivate: jest.SpyInstance;

  beforeEach(() => {
    superCanActivate = jest
      .spyOn(
        Object.getPrototypeOf(GoogleCallbackGuard.prototype) as {
          canActivate: () => boolean;
        },
        'canActivate',
      )
      .mockReturnValue(true);
  });

  afterEach(() => {
    superCanActivate.mockRestore();
  });

  it('delegates to the underlying passport guard when state is valid', async () => {
    const guard = new GoogleCallbackGuard(makeConfig());
    const state = signOAuthState(JWT_SECRET, {}, 60_000);
    const context = makeContext({ state });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(superCanActivate).toHaveBeenCalledWith(context);
  });

  it('rejects before delegating when state is missing', async () => {
    const guard = new GoogleCallbackGuard(makeConfig());
    const context = makeContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('rejects before delegating when state is tampered', async () => {
    const guard = new GoogleCallbackGuard(makeConfig());
    const state = signOAuthState(JWT_SECRET, {}, 60_000);
    const parsed = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf8'),
    ) as { payload: string; sig: string };
    parsed.sig = 'a'.repeat(64);
    const tampered = Buffer.from(JSON.stringify(parsed)).toString('base64url');
    const context = makeContext({ state: tampered });

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('rejects before delegating when state is expired', async () => {
    const guard = new GoogleCallbackGuard(makeConfig());
    const state = signOAuthState(JWT_SECRET, {}, -1);
    const context = makeContext({ state });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'OAuth state expired',
    );
    expect(superCanActivate).not.toHaveBeenCalled();
  });
});
