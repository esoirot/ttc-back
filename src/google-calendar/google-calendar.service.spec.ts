import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarService } from './google-calendar.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';

jest.mock('../common/retry.util');
import { fetchWithRetry } from '../common/retry.util';
const mockFetch = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;

const JWT_SECRET = 'test-jwt-secret';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  email: 'user@example.com',
  googleCalendarAccessToken: 'acc-token',
  googleCalendarRefreshToken: 'ref-token',
  googleCalendarTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
  googleCalendarEmail: 'user@gmail.com',
  ...overrides,
});

const makeOkResponse = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(data),
  } as Response);

const makeErrorResponse = (status: number, message?: string) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(message ? { error: { message } } : {}),
  } as Response);

// mockFetch normally resolves directly, bypassing the callback passed to
// fetchWithRetry — so request()'s own fetch() call (headers/body construction)
// never actually runs. This variant makes the mock invoke that callback for
// real, against a controllable global.fetch spy, for tests that need to
// assert on the actual outgoing request.
const invokeRealFetch = () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  mockFetch.mockImplementation(async (cb) => cb(new AbortController().signal));
  return fetchSpy;
};

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService;
  let usersService: {
    findOne: jest.Mock;
    updateGoogleCalendar: jest.Mock;
  };
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findOne: jest.fn().mockResolvedValue(makeUser()),
      updateGoogleCalendar: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { log: jest.fn() };

    const configMap: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_CALENDAR_REDIRECT_URI:
        'http://localhost:3000/google-calendar/auth/callback',
      FRONTEND_URL: 'http://localhost:5173',
      JWT_SECRET,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCalendarService,
        { provide: UsersService, useValue: usersService },
        { provide: AuditService, useValue: auditService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((k: string) => configMap[k]),
          },
        },
      ],
    }).compile();

    service = module.get(GoogleCalendarService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor config defaults', () => {
    it('falls back to defaults when config values are unset', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GoogleCalendarService,
          { provide: UsersService, useValue: usersService },
          { provide: AuditService, useValue: auditService },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();
      const s2 = module.get(GoogleCalendarService);

      const url = s2.buildAuthUrl(1);
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('client_id')).toBe('');
      expect(params.get('redirect_uri')).toBe(
        'http://localhost:3000/google-calendar/auth/callback',
      );
      expect(s2.callbackRedirectUrl).toBe(
        'http://localhost:5173/google-calendar',
      );
    });
  });

  describe('buildAuthUrl', () => {
    it('returns Google OAuth URL', () => {
      const url = service.buildAuthUrl(1);
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=client-id');
    });

    it('requests the calendar.events and userinfo.email scopes, not full calendar scope', () => {
      const url = service.buildAuthUrl(1);
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('scope')).toBe(
        'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
      );
    });

    it('requests offline access with consent prompt (for refresh token)', () => {
      const url = service.buildAuthUrl(1);
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('access_type')).toBe('offline');
      expect(params.get('prompt')).toBe('consent');
    });

    it('includes signed state in URL', () => {
      const url = service.buildAuthUrl(1);
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('state')).toBeTruthy();
    });
  });

  describe('callbackRedirectUrl', () => {
    it('builds the redirect URL from FRONTEND_URL', () => {
      expect(service.callbackRedirectUrl).toBe(
        'http://localhost:5173/google-calendar',
      );
    });
  });

  describe('getStatus', () => {
    it('returns connected=true when user has accessToken', async () => {
      const result = await service.getStatus(1);
      expect(result).toEqual({ connected: true, email: 'user@gmail.com' });
    });

    it('returns connected=false when user has no accessToken', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({
          googleCalendarAccessToken: null,
          googleCalendarEmail: null,
        }),
      );
      const result = await service.getStatus(1);
      expect(result).toEqual({ connected: false, email: null });
    });
  });

  describe('disconnect', () => {
    let globalFetchSpy: jest.SpyInstance;

    beforeEach(() => {
      globalFetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true } as Response);
    });

    afterEach(() => {
      globalFetchSpy.mockRestore();
    });

    it('nulls all google calendar fields', async () => {
      await service.disconnect(1);
      expect(usersService.updateGoogleCalendar).toHaveBeenCalledWith(1, {
        googleCalendarAccessToken: null,
        googleCalendarRefreshToken: null,
        googleCalendarTokenExpiresAt: null,
        googleCalendarEmail: null,
      });
    });

    it('audit-logs the disconnect', async () => {
      await service.disconnect(1);
      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'GOOGLE_CALENDAR_DISCONNECT',
        'google-calendar:connections/1',
      );
    });

    it('revokes the refresh token server-side when one exists', async () => {
      await service.disconnect(1);

      expect(globalFetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('oauth2.googleapis.com/revoke?token=ref-token'),
        { method: 'POST' },
      );
    });

    it('skips revocation when the user has no refresh token', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ googleCalendarRefreshToken: null }),
      );

      await service.disconnect(1);

      expect(globalFetchSpy).not.toHaveBeenCalled();
    });

    it('logs and does not throw when revocation fails', async () => {
      globalFetchSpy.mockRejectedValue(new Error('network down'));

      await expect(service.disconnect(1)).resolves.toBeUndefined();
      await new Promise((r) => setImmediate(r)); // let the fire-and-forget .catch() run
    });
  });

  describe('handleCallback', () => {
    let globalFetchSpy: jest.SpyInstance;

    beforeEach(() => {
      globalFetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      globalFetchSpy.mockRestore();
    });

    it('exchanges code for tokens and stores credentials', async () => {
      const authUrl = service.buildAuthUrl(1);
      const state = new URLSearchParams(authUrl.split('?')[1]).get('state')!;

      globalFetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-acc',
              refresh_token: 'new-ref',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ email: 'new@gmail.com' }),
        });

      await service.handleCallback('code-abc', state);

      expect(usersService.updateGoogleCalendar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          googleCalendarAccessToken: 'new-acc',
          googleCalendarRefreshToken: 'new-ref',
          googleCalendarEmail: 'new@gmail.com',
        }),
      );
    });

    it('throws HttpException when token exchange fails', async () => {
      const authUrl = service.buildAuthUrl(1);
      const state = new URLSearchParams(authUrl.split('?')[1]).get('state')!;

      globalFetchSpy.mockResolvedValueOnce({ ok: false, status: 400 } as any);

      await expect(service.handleCallback('bad-code', state)).rejects.toThrow(
        'Google Calendar token exchange failed',
      );
    });

    it('throws BadRequestException for invalid OAuth state', async () => {
      await expect(
        service.handleCallback('code', 'invalid-base64!!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores a null email when the userinfo fetch fails', async () => {
      const authUrl = service.buildAuthUrl(1);
      const state = new URLSearchParams(authUrl.split('?')[1]).get('state')!;

      globalFetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-acc',
              refresh_token: 'new-ref',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({ ok: false, status: 401 });

      await service.handleCallback('code-abc', state);

      expect(usersService.updateGoogleCalendar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ googleCalendarEmail: null }),
      );
    });

    it('stores a null email when userinfo succeeds but has no email field', async () => {
      const authUrl = service.buildAuthUrl(1);
      const state = new URLSearchParams(authUrl.split('?')[1]).get('state')!;

      globalFetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'new-acc',
              refresh_token: 'new-ref',
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      await service.handleCallback('code-abc', state);

      expect(usersService.updateGoogleCalendar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ googleCalendarEmail: null }),
      );
    });

    it('stores a null refresh token when the token exchange omits one', async () => {
      const authUrl = service.buildAuthUrl(1);
      const state = new URLSearchParams(authUrl.split('?')[1]).get('state')!;

      globalFetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ access_token: 'new-acc', expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ email: 'new@gmail.com' }),
        });

      await service.handleCallback('code-abc', state);

      expect(usersService.updateGoogleCalendar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ googleCalendarRefreshToken: null }),
      );
    });

    it('throws BadRequestException for tampered state signature', async () => {
      const authUrl = service.buildAuthUrl(1);
      const raw = Buffer.from(
        new URLSearchParams(authUrl.split('?')[1]).get('state')!,
        'base64url',
      ).toString();
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      parsed['sig'] = 'a'.repeat(64); // tamper
      const tampered = Buffer.from(JSON.stringify(parsed)).toString(
        'base64url',
      );

      await expect(service.handleCallback('code', tampered)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for an expired OAuth state', async () => {
      const authUrl = service.buildAuthUrl(1);
      const state = new URLSearchParams(authUrl.split('?')[1]).get('state')!;

      jest.useFakeTimers({ doNotFake: ['nextTick'] });
      jest.advanceTimersByTime(11 * 60 * 1000); // past the 10min OAuth state TTL

      await expect(service.handleCallback('code', state)).rejects.toThrow(
        'OAuth state expired',
      );
      jest.useRealTimers();
    });
  });

  describe('getValidToken (via listEvents)', () => {
    it('throws BadRequestException when user has no accessToken', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ googleCalendarAccessToken: null }),
      );

      await expect(
        service.listEvents(1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns events without refresh when not near expiry', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ items: [] }));

      const result = await service.listEvents(
        1,
        '2026-01-01T00:00:00Z',
        '2026-02-01T00:00:00Z',
      );

      expect(result.items).toEqual([]);
    });

    it('throws BadRequestException when near expiry and no refresh token', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({
          googleCalendarTokenExpiresAt: new Date(Date.now() + 60_000), // 1min — below 5min margin
          googleCalendarRefreshToken: null,
        }),
      );

      await expect(
        service.listEvents(1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshAccessToken (via listEvents)', () => {
    let globalFetchSpy: jest.SpyInstance;

    beforeEach(() => {
      globalFetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      globalFetchSpy.mockRestore();
    });

    it('refreshes token when near expiry and stores new credentials', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({
          googleCalendarTokenExpiresAt: new Date(Date.now() + 60_000),
        }),
      );
      globalFetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'refreshed-tok',
            refresh_token: 'new-ref',
            expires_in: 3600,
          }),
      });
      mockFetch.mockResolvedValue(makeOkResponse({ items: [] }));

      await service.listEvents(
        1,
        '2026-01-01T00:00:00Z',
        '2026-02-01T00:00:00Z',
      );

      expect(usersService.updateGoogleCalendar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          googleCalendarAccessToken: 'refreshed-tok',
          googleCalendarRefreshToken: 'new-ref',
        }),
      );
    });

    it('does not overwrite the stored refresh token when Google omits one', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({
          googleCalendarTokenExpiresAt: new Date(Date.now() + 60_000),
        }),
      );
      globalFetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'refreshed-tok',
            expires_in: 3600,
            // no refresh_token in the response
          }),
      });
      mockFetch.mockResolvedValue(makeOkResponse({ items: [] }));

      await service.listEvents(
        1,
        '2026-01-01T00:00:00Z',
        '2026-02-01T00:00:00Z',
      );

      const calls = usersService.updateGoogleCalendar.mock.calls as unknown as [
        number,
        Record<string, unknown>,
      ][];
      const call = calls[0][1];
      expect(call).not.toHaveProperty('googleCalendarRefreshToken');
      expect(call.googleCalendarAccessToken).toBe('refreshed-tok');
    });

    it('throws HttpException when refresh fetch fails', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({
          googleCalendarTokenExpiresAt: new Date(Date.now() + 60_000),
        }),
      );
      globalFetchSpy.mockResolvedValue({ ok: false, status: 401 } as any);

      await expect(
        service.listEvents(1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
      ).rejects.toThrow('Google Calendar token refresh failed');
    });

    it('coalesces concurrent refresh calls for the same user into one request', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({
          googleCalendarTokenExpiresAt: new Date(Date.now() + 60_000),
        }),
      );
      globalFetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'refreshed-tok',
            refresh_token: 'new-ref',
            expires_in: 3600,
          }),
      });
      mockFetch.mockResolvedValue(makeOkResponse({ items: [] }));

      await Promise.all([
        service.listEvents(1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
        service.listEvents(1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
      ]);

      expect(globalFetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('request() outgoing call construction', () => {
    it('sends Authorization and Content-Type when the request has a body', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'e-new' }), { status: 200 }),
      );

      await service.createEvent(1, {
        summary: 'Call',
        startDateTime: '2026-01-01T10:00:00Z',
        endDateTime: '2026-01-01T11:00:00Z',
      });

      const [, init] = fetchSpy.mock.calls[0];
      expect(init).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer acc-token',
          'Content-Type': 'application/json',
        }) as Record<string, string>,
      });
    });

    it('sends no Content-Type or body for a bodyless request', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );

      await service.listEvents(
        1,
        '2026-01-01T00:00:00Z',
        '2026-02-01T00:00:00Z',
      );

      const [, init] = fetchSpy.mock.calls[0];
      expect(init?.body).toBeUndefined();
      expect(
        (init?.headers as Record<string, string>)['Content-Type'],
      ).toBeUndefined();
    });

    it('includes timeMin/timeMax in the list URL', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );

      await service.listEvents(
        1,
        '2026-01-01T00:00:00Z',
        '2026-02-01T00:00:00Z',
      );

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url as string)).toContain(
        'timeMin=2026-01-01T00%3A00%3A00Z',
      );
      expect(String(url as string)).toContain(
        'timeMax=2026-02-01T00%3A00%3A00Z',
      );
    });

    it('falls back to a generic message when the error body has no message', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500));

      await expect(
        service.listEvents(1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
      ).rejects.toThrow('Google Calendar API error');
    });

    it('falls back to a generic message when the error body is not valid JSON', async () => {
      mockFetch.mockResolvedValue(
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.reject(new Error('not json')),
        } as unknown as Response),
      );

      await expect(
        service.listEvents(1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
      ).rejects.toThrow('Google Calendar API error');
    });

    it('falls back to a generic message when error.message is not a string', async () => {
      mockFetch.mockResolvedValue(
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: { code: 403 } }),
        } as unknown as Response),
      );

      await expect(
        service.listEvents(1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z'),
      ).rejects.toThrow('Google Calendar API error');
    });
  });

  describe('createEvent', () => {
    it('posts to Google Calendar and logs audit', async () => {
      const event = { id: 'e-new', summary: 'Call' };
      mockFetch.mockResolvedValue(makeOkResponse(event));

      const dto = {
        summary: 'Call',
        startDateTime: '2026-01-01T10:00:00Z',
        endDateTime: '2026-01-01T11:00:00Z',
      };
      const result = await service.createEvent(1, dto);

      expect(result).toEqual(event);
      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'GOOGLE_CALENDAR_CREATE_EVENT',
        'google-calendar:events/e-new',
        dto,
      );
    });

    it('builds start/end as dateTime objects', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'e-new' }), { status: 200 }),
      );

      await service.createEvent(1, {
        summary: 'Call',
        startDateTime: '2026-01-01T10:00:00Z',
        endDateTime: '2026-01-01T11:00:00Z',
      });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as {
        summary: string;
        start: { dateTime: string };
        end: { dateTime: string };
      };
      expect(body).toEqual({
        summary: 'Call',
        start: { dateTime: '2026-01-01T10:00:00Z' },
        end: { dateTime: '2026-01-01T11:00:00Z' },
      });
    });
  });
});
