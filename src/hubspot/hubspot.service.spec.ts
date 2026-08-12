import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { HubspotService } from './hubspot.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { ClientsService } from '../clients/clients.service';
import { OAuthTokenRefreshService } from '../common/oauth-token/oauth-token-refresh.service';
import type { HubspotWebhookEvent } from './types/hubspot-webhook.type';

const makeWebhookEvent = (
  overrides: Partial<HubspotWebhookEvent> = {},
): HubspotWebhookEvent => ({
  eventId: 1,
  subscriptionId: 1,
  portalId: 1,
  appId: 1,
  occurredAt: Date.now(),
  subscriptionType: 'contact.propertyChange',
  attemptNumber: 1,
  objectId: 1,
  ...overrides,
});

jest.mock('../common/retry.util');
import { fetchWithRetry } from '../common/retry.util';
const mockFetch = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;

const WEBHOOK_SECRET = 'test-webhook-secret';
const WEBHOOK_URL = 'http://localhost:3000/hubspot/webhooks';
const JWT_SECRET = 'test-jwt-secret';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  email: 'user@example.com',
  hubspotAccessToken: 'acc-token',
  hubspotRefreshToken: 'ref-token',
  hubspotTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
  hubspotPortalId: 'portal-123',
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
    json: () => Promise.resolve(message ? { message } : {}),
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

describe('HubspotService', () => {
  let service: HubspotService;
  let usersService: {
    findOne: jest.Mock;
    findAll: jest.Mock;
    updateHubspot: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let clientsService: {
    importFromHubspot: jest.Mock;
    findByHubspotIdGlobal: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findOne: jest.fn().mockResolvedValue(makeUser()),
      findAll: jest.fn().mockResolvedValue([makeUser()]),
      updateHubspot: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { log: jest.fn() };
    clientsService = {
      importFromHubspot: jest.fn(),
      findByHubspotIdGlobal: jest.fn(),
      update: jest.fn(),
    };

    const configMap: Record<string, string> = {
      HUBSPOT_CLIENT_ID: 'client-id',
      HUBSPOT_CLIENT_SECRET: 'client-secret',
      HUBSPOT_REDIRECT_URI: 'http://localhost:3000/hubspot/auth/callback',
      HUBSPOT_WEBHOOK_SECRET: WEBHOOK_SECRET,
      HUBSPOT_WEBHOOK_URL: WEBHOOK_URL,
      FRONTEND_URL: 'http://localhost:5173',
      JWT_SECRET,
      HUBSPOT_APP_ID: 'app-123',
      HUBSPOT_PRIVATE_APP_TOKEN: 'papp-token',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HubspotService,
        OAuthTokenRefreshService,
        { provide: UsersService, useValue: usersService },
        { provide: AuditService, useValue: auditService },
        { provide: ClientsService, useValue: clientsService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((k: string) => configMap[k]),
          },
        },
      ],
    }).compile();

    service = module.get(HubspotService);
  });

  afterEach(() => {
    // resetAllMocks (not clearAllMocks) — clearAllMocks leaves queued
    // mockResolvedValueOnce()/mockImplementation() entries in place, so an
    // unconsumed once-value from one test can leak into the next.
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildAuthUrl', () => {
    it('returns HubSpot OAuth URL', () => {
      const url = service.buildAuthUrl(1);
      expect(url).toContain('https://app.hubspot.com/oauth/authorize');
      expect(url).toContain('client_id=client-id');
    });

    it('includes signed state in URL', () => {
      const url = service.buildAuthUrl(1);
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('state')).toBeTruthy();
    });
  });

  describe('callbackRedirectUrl', () => {
    it('builds the redirect URL from FRONTEND_URL', () => {
      expect(service.callbackRedirectUrl).toBe('http://localhost:5173/hubspot');
    });
  });

  describe('getStatus', () => {
    it('returns connected=true when user has accessToken', async () => {
      const result = await service.getStatus(1);
      expect(result).toEqual({ connected: true, portalId: 'portal-123' });
    });

    it('returns connected=false when user has no accessToken', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ hubspotAccessToken: null, hubspotPortalId: null }),
      );
      const result = await service.getStatus(1);
      expect(result).toEqual({ connected: false, portalId: null });
    });
  });

  describe('disconnect', () => {
    let globalFetchSpy: jest.SpyInstance;

    beforeEach(() => {
      // disconnect() fires a real fetch() (not fetchWithRetry) to revoke the
      // refresh token — stub it so unit tests never hit the network.
      globalFetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true } as Response);
    });

    afterEach(() => {
      globalFetchSpy.mockRestore();
    });

    it('nulls all hubspot fields', async () => {
      await service.disconnect(1);
      expect(usersService.updateHubspot).toHaveBeenCalledWith(1, {
        hubspotAccessToken: null,
        hubspotRefreshToken: null,
        hubspotTokenExpiresAt: null,
        hubspotPortalId: null,
      });
    });

    it('revokes the refresh token server-side when one exists', async () => {
      await service.disconnect(1);

      expect(globalFetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/v1/refresh-tokens/ref-token'),
        { method: 'DELETE' },
      );
    });

    it('does not audit-log a self-service disconnect (no actingAdminId)', async () => {
      await service.disconnect(1);
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('audit-logs when an admin force-disconnects another user', async () => {
      await service.disconnect(1, 99);
      expect(auditService.log).toHaveBeenCalledWith(
        99,
        'HUBSPOT_ADMIN_FORCE_DISCONNECT',
        'hubspot:connections/1',
      );
    });

    it('skips revocation when the user has no refresh token', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ hubspotRefreshToken: null }),
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

  describe('listConnections', () => {
    it('maps all users to connection summaries', async () => {
      const users = [
        makeUser({ id: 1, email: 'a@b.com', hubspotAccessToken: 'tok' }),
        makeUser({ id: 2, email: 'c@d.com', hubspotAccessToken: null }),
      ];
      usersService.findAll.mockResolvedValue(users);

      const result = await service.listConnections();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        userId: 1,
        email: 'a@b.com',
        connected: true,
      });
      expect(result[1]).toMatchObject({
        userId: 2,
        email: 'c@d.com',
        connected: false,
      });
    });

    it('falls back to null for missing portalId / expiresAt', async () => {
      usersService.findAll.mockResolvedValue([
        makeUser({
          id: 3,
          hubspotPortalId: null,
          hubspotTokenExpiresAt: null,
        }),
      ]);

      const result = await service.listConnections();

      expect(result[0]).toMatchObject({ portalId: null, expiresAt: null });
    });
  });

  describe('verifyWebhookSignature', () => {
    const rawBody = '[]';
    const sign = (timestamp: string, body = rawBody) =>
      createHmac('sha256', WEBHOOK_SECRET)
        .update(`POST${WEBHOOK_URL}${body}${timestamp}`)
        .digest('base64');

    it('passes for valid signature', () => {
      const ts = String(Date.now());
      expect(() =>
        service.verifyWebhookSignature(rawBody, sign(ts), ts),
      ).not.toThrow();
    });

    it('throws UnauthorizedException when timestamp is missing', () => {
      const ts = String(Date.now());
      expect(() =>
        service.verifyWebhookSignature(rawBody, sign(ts), ''),
      ).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for stale request (replay protection)', () => {
      const staleTs = String(Date.now() - 6 * 60 * 1000); // 6 min ago
      expect(() =>
        service.verifyWebhookSignature(rawBody, sign(staleTs), staleTs),
      ).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for invalid signature', () => {
      const ts = String(Date.now());
      expect(() =>
        service.verifyWebhookSignature(rawBody, 'a'.repeat(44), ts),
      ).toThrow(UnauthorizedException);
    });

    it('recent timestamp passes replay check', () => {
      const recentTs = String(Date.now() - 60 * 1000); // 1 min ago
      expect(() =>
        service.verifyWebhookSignature(rawBody, sign(recentTs), recentTs),
      ).not.toThrow();
    });

    it('rejects a captured signature replayed with a forged fresh timestamp (#8)', () => {
      // Old v1 scheme (sha256(secret+body)) never bound the timestamp into the
      // signature, so an attacker replaying a captured payload+signature pair
      // could just forge a fresh `x-hubspot-request-timestamp` and pass the
      // replay-window check every time. The v3 scheme signs the timestamp
      // itself, so a mismatched (forged) timestamp invalidates the signature.
      const originalTs = String(Date.now() - 60 * 1000);
      const capturedSignature = sign(originalTs);
      const forgedTs = String(Date.now());
      expect(() =>
        service.verifyWebhookSignature(rawBody, capturedSignature, forgedTs),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('handleWebhookEvents', () => {
    it('dispatches each event', async () => {
      clientsService.findByHubspotIdGlobal.mockResolvedValue(null);

      const events = [
        makeWebhookEvent({
          objectId: 99,
          propertyName: 'email',
          propertyValue: 'new@x.com',
          eventId: 1,
        }),
        makeWebhookEvent({
          objectId: 88,
          propertyName: 'phone',
          propertyValue: '555',
          eventId: 2,
        }),
      ];

      service.handleWebhookEvents(events);

      // Fire-and-forget dispatch — wait for promises to resolve
      await new Promise((r) => setImmediate(r));

      expect(clientsService.findByHubspotIdGlobal).toHaveBeenCalledTimes(2);
    });

    it('contact.propertyChange — updates client when field matches', async () => {
      const client = { id: 5, userId: 1 };
      clientsService.findByHubspotIdGlobal.mockResolvedValue(client);
      clientsService.update.mockResolvedValue({
        ...client,
        email: 'new@x.com',
      });

      service.handleWebhookEvents([
        makeWebhookEvent({
          objectId: 123,
          propertyName: 'email',
          propertyValue: 'new@x.com',
        }),
      ]);

      await new Promise((r) => setImmediate(r));

      expect(clientsService.update).toHaveBeenCalledWith(5, 1, {
        id: 5,
        email: 'new@x.com',
      });
    });

    it('contact.propertyChange — skips unmapped fields', async () => {
      const client = { id: 5, userId: 1 };
      clientsService.findByHubspotIdGlobal.mockResolvedValue(client);

      service.handleWebhookEvents([
        makeWebhookEvent({
          objectId: 123,
          propertyName: 'firstname',
          propertyValue: 'Bob',
        }),
      ]);

      await new Promise((r) => setImmediate(r));

      expect(clientsService.update).not.toHaveBeenCalled();
    });

    it('contact.propertyChange — skips when no client found', async () => {
      clientsService.findByHubspotIdGlobal.mockResolvedValue(null);

      service.handleWebhookEvents([
        makeWebhookEvent({
          objectId: 999,
          propertyName: 'email',
          propertyValue: 'x@y.com',
        }),
      ]);

      await new Promise((r) => setImmediate(r));

      expect(clientsService.update).not.toHaveBeenCalled();
    });

    it('ignores subscription types with no handler', async () => {
      service.handleWebhookEvents([
        makeWebhookEvent({ subscriptionType: 'deal.creation' }),
      ]);

      await new Promise((r) => setImmediate(r));

      expect(clientsService.findByHubspotIdGlobal).not.toHaveBeenCalled();
    });

    it('logs and does not throw when the handler rejects', async () => {
      clientsService.findByHubspotIdGlobal.mockRejectedValue(
        new Error('db down'),
      );

      expect(() =>
        service.handleWebhookEvents([
          makeWebhookEvent({
            propertyName: 'email',
            propertyValue: 'x@y.com',
          }),
        ]),
      ).not.toThrow();

      await new Promise((r) => setImmediate(r));
    });
  });

  describe('getValidToken (via listContacts)', () => {
    it('throws BadRequestException when user has no accessToken', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ hubspotAccessToken: null }),
      );

      await expect(service.listContacts(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns valid token without refresh when not near expiry', async () => {
      const contact = { id: 'c1', properties: { email: 'u@x.com' } };
      mockFetch.mockResolvedValue(
        makeOkResponse({ results: [contact], paging: undefined }),
      );

      const result = await service.listContacts(1);

      expect(result.results).toHaveLength(1);
      // fetchWithRetry called with user's access token (not refreshed)
    });

    it('throws BadRequestException when near expiry and no refresh token', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({
          hubspotTokenExpiresAt: new Date(Date.now() + 60_000), // 1min — below 5min margin
          hubspotRefreshToken: null,
        }),
      );

      await expect(service.listContacts(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('request() outgoing call construction', () => {
    it('sends Authorization and Content-Type when the request has a body', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'c-new' }), { status: 200 }),
      );

      await service.createContact(1, { email: 'x@y.com' });

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
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      await service.listContacts(1);

      const [, init] = fetchSpy.mock.calls[0];
      expect(init?.body).toBeUndefined();
      expect(
        (init?.headers as Record<string, string>)['Content-Type'],
      ).toBeUndefined();
    });

    it('includes an after cursor when given', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      await service.listContacts(1, 'cursor-1');

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url as string)).toContain('after=cursor-1');
    });

    it('falls back to a generic message when the error body has no message', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(500));

      await expect(service.listContacts(1)).rejects.toThrow(
        'HubSpot API error',
      );
    });

    it('falls back to a generic message when the error body is not valid JSON', async () => {
      mockFetch.mockResolvedValue(
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.reject(new Error('not json')),
        } as unknown as Response),
      );

      await expect(service.listContacts(1)).rejects.toThrow(
        'HubSpot API error',
      );
    });
  });

  describe('importContact', () => {
    it('fetches contact, imports as client, logs audit', async () => {
      const contact = {
        id: 'c-42',
        properties: {
          email: 'bob@example.com',
          firstname: 'Bob',
          lastname: 'Smith',
          phone: '555',
          company: 'ACME',
        },
      };
      mockFetch.mockResolvedValue(makeOkResponse(contact));
      const importedClient = { id: 7, name: 'Bob Smith' };
      clientsService.importFromHubspot.mockResolvedValue(importedClient);

      const result = await service.importContact(1, 'c-42');

      expect(clientsService.importFromHubspot).toHaveBeenCalledWith(
        1,
        'c-42',
        expect.objectContaining({
          name: 'Bob Smith',
          email: 'bob@example.com',
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'HUBSPOT_IMPORT_CLIENT',
        'hubspot:contacts/c-42',
        expect.objectContaining({ contactId: 'c-42', clientId: 7 }),
      );
      expect(result).toEqual(importedClient);
    });

    it('uses company name when no first/last name', async () => {
      const contact = {
        id: 'c-99',
        properties: {
          email: '',
          firstname: '',
          lastname: '',
          phone: '',
          company: 'ACME Ltd',
        },
      };
      mockFetch.mockResolvedValue(makeOkResponse(contact));
      clientsService.importFromHubspot.mockResolvedValue({
        id: 8,
        name: 'ACME Ltd',
      });

      await service.importContact(1, 'c-99');

      expect(clientsService.importFromHubspot).toHaveBeenCalledWith(
        1,
        'c-99',
        expect.objectContaining({ name: 'ACME Ltd' }),
      );
    });

    it('falls back to "Unnamed" when all name fields empty', async () => {
      const contact = {
        id: 'c-0',
        properties: {
          email: '',
          firstname: '',
          lastname: '',
          phone: '',
          company: '',
        },
      };
      mockFetch.mockResolvedValue(makeOkResponse(contact));
      clientsService.importFromHubspot.mockResolvedValue({
        id: 9,
        name: 'Unnamed',
      });

      await service.importContact(1, 'c-0');

      expect(clientsService.importFromHubspot).toHaveBeenCalledWith(
        1,
        'c-0',
        expect.objectContaining({ name: 'Unnamed' }),
      );
    });
  });

  describe('createContact', () => {
    it('posts to HubSpot and logs audit', async () => {
      const contact = { id: 'c-new', properties: {} };
      mockFetch.mockResolvedValue(makeOkResponse(contact));

      const dto = { email: 'new@x.com', firstname: 'Alice' };
      const result = await service.createContact(1, dto);

      expect(result).toEqual(contact);
      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'HUBSPOT_CREATE_CONTACT',
        'hubspot:contacts/c-new',
        dto,
      );
    });

    it('omits optional properties that are not provided', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'c-new', properties: {} }), {
          status: 200,
        }),
      );

      await service.createContact(1, { email: 'x@y.com' });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as {
        properties: Record<string, unknown>;
      };
      expect(body.properties).toEqual({ email: 'x@y.com' });
    });
  });

  describe('searchContacts', () => {
    it('defaults properties when the dto does not specify any', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      await service.searchContacts(1, { filterGroups: [] });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as {
        properties: string[];
      };
      expect(body.properties).toEqual([
        'email',
        'firstname',
        'lastname',
        'phone',
        'company',
      ]);
    });

    it('uses caller-provided properties when given', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      await service.searchContacts(1, {
        filterGroups: [],
        properties: ['email'],
      });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as {
        properties: string[];
      };
      expect(body.properties).toEqual(['email']);
    });
  });

  describe('updateContact', () => {
    it('patches contact and logs audit', async () => {
      const contact = { id: 'c-42', properties: {} };
      mockFetch.mockResolvedValue(makeOkResponse(contact));

      const dto = { email: 'updated@x.com' };
      await service.updateContact(1, 'c-42', dto);

      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'HUBSPOT_UPDATE_CONTACT',
        'hubspot:contacts/c-42',
        dto,
      );
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
          json: () => Promise.resolve({ hub_id: 999 }),
        });

      await service.handleCallback('code-abc', state);

      expect(usersService.updateHubspot).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          hubspotAccessToken: 'new-acc',
          hubspotRefreshToken: 'new-ref',
          hubspotPortalId: '999',
        }),
      );
    });

    it('throws HttpException when token exchange fails', async () => {
      const authUrl = service.buildAuthUrl(1);
      const state = new URLSearchParams(authUrl.split('?')[1]).get('state')!;

      globalFetchSpy.mockResolvedValueOnce({ ok: false, status: 400 } as any);

      await expect(service.handleCallback('bad-code', state)).rejects.toThrow(
        'HubSpot token exchange failed',
      );
    });

    it('throws BadRequestException for invalid OAuth state', async () => {
      await expect(
        service.handleCallback('code', 'invalid-base64!!'),
      ).rejects.toThrow(BadRequestException);
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

  describe('refreshAccessToken (via getValidToken)', () => {
    let globalFetchSpy: jest.SpyInstance;

    beforeEach(() => {
      globalFetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      globalFetchSpy.mockRestore();
    });

    it('refreshes token when near expiry and stores new credentials', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ hubspotTokenExpiresAt: new Date(Date.now() + 60_000) }),
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
      mockFetch.mockResolvedValue(makeOkResponse({ results: [] }));

      await service.listContacts(1);

      expect(usersService.updateHubspot).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ hubspotAccessToken: 'refreshed-tok' }),
      );
    });

    it('throws HttpException when refresh fetch fails', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ hubspotTokenExpiresAt: new Date(Date.now() + 60_000) }),
      );
      globalFetchSpy.mockResolvedValue({ ok: false, status: 401 } as any);

      await expect(service.listContacts(1)).rejects.toThrow(
        'HubSpot token refresh failed',
      );
    });
  });

  describe('companies CRUD', () => {
    it('listCompanies — delegates to request', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ results: [] }));

      await service.listCompanies(1);

      expect(mockFetch).toHaveBeenCalled();
    });

    it('listCompanies — includes after cursor when given', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      await service.listCompanies(1, 'cursor-1');

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url as string)).toContain('after=cursor-1');
    });

    it('createCompany — posts and logs audit', async () => {
      const company = { id: 'co-new', properties: {} };
      mockFetch.mockResolvedValue(makeOkResponse(company));

      const dto = { name: 'ACME Ltd' };
      await service.createCompany(1, dto);

      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'HUBSPOT_CREATE_COMPANY',
        'hubspot:companies/co-new',
        dto,
      );
    });

    it('createCompany — omits optional properties that are not provided', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'co-new', properties: {} }), {
          status: 200,
        }),
      );

      await service.createCompany(1, { name: 'ACME Ltd' });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as {
        properties: Record<string, unknown>;
      };
      expect(body.properties).toEqual({ name: 'ACME Ltd' });
    });

    it('updateCompany — patches and logs audit', async () => {
      const company = { id: 'co-5', properties: {} };
      mockFetch.mockResolvedValue(makeOkResponse(company));

      const dto = { name: 'New Name' };
      await service.updateCompany(1, 'co-5', dto);

      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'HUBSPOT_UPDATE_COMPANY',
        'hubspot:companies/co-5',
        dto,
      );
    });

    it('searchCompanies — delegates to request', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ results: [] }));

      await service.searchCompanies(1, { filterGroups: [] });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('getCompany — delegates to request', async () => {
      const company = { id: 'co-9', properties: {} };
      mockFetch.mockResolvedValue(makeOkResponse(company));

      const result = await service.getCompany(1, 'co-9');
      expect(result).toEqual(company);
    });
  });

  describe('deals CRUD', () => {
    it('listDeals — delegates to request', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ results: [] }));
      await service.listDeals(1);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('listDeals — includes after cursor when given', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      await service.listDeals(1, 'cursor-2');

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url as string)).toContain('after=cursor-2');
    });

    it('createDeal — posts and logs audit', async () => {
      const deal = { id: 'd-new', properties: {} };
      mockFetch.mockResolvedValue(makeOkResponse(deal));

      const dto = { dealname: 'Big Deal', amount: '5000' };
      await service.createDeal(1, dto);

      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'HUBSPOT_CREATE_DEAL',
        'hubspot:deals/d-new',
        dto,
      );
    });

    it('createDeal — omits optional properties that are not provided', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'd-new', properties: {} }), {
          status: 200,
        }),
      );

      await service.createDeal(1, { dealname: 'Big Deal' });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as {
        properties: Record<string, unknown>;
      };
      expect(body.properties).toEqual({ dealname: 'Big Deal' });
    });

    it('updateDeal — patches and logs audit', async () => {
      const deal = { id: 'd-7', properties: {} };
      mockFetch.mockResolvedValue(makeOkResponse(deal));

      const dto = { dealname: 'Updated Deal' };
      await service.updateDeal(1, 'd-7', dto);

      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'HUBSPOT_UPDATE_DEAL',
        'hubspot:deals/d-7',
        dto,
      );
    });

    it('searchDeals — delegates to request', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ results: [] }));
      await service.searchDeals(1, { filterGroups: [] });
      expect(mockFetch).toHaveBeenCalled();
    });

    it('getDeal — delegates to request', async () => {
      const deal = { id: 'd-3', properties: {} };
      mockFetch.mockResolvedValue(makeOkResponse(deal));

      const result = await service.getDeal(1, 'd-3');
      expect(result).toEqual(deal);
    });
  });

  describe('createAssociation', () => {
    it('puts association and logs audit', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(null, 204));

      await service.createAssociation(1, {
        fromObjectType: 'contacts',
        fromObjectId: '1',
        toObjectType: 'companies',
        toObjectId: '2',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'HUBSPOT_CREATE_ASSOCIATION',
        expect.stringContaining('associations'),
      );
    });

    it('throws BadRequestException for unknown type pair', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({}));

      await expect(
        service.createAssociation(1, {
          fromObjectType: 'deals',
          fromObjectId: '1',
          toObjectType: 'companies',
          toObjectId: '2',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['contacts', 'deals'],
      ['companies', 'contacts'],
      ['deals', 'contacts'],
    ])(
      'resolves a default associationTypeId for %s -> %s',
      async (fromObjectType, toObjectType) => {
        mockFetch.mockResolvedValue(makeOkResponse(null, 204));

        await expect(
          service.createAssociation(1, {
            fromObjectType,
            fromObjectId: '1',
            toObjectType,
            toObjectId: '2',
          }),
        ).resolves.toBeUndefined();
      },
    );

    it('uses an explicit associationTypeId when given', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));

      await service.createAssociation(1, {
        fromObjectType: 'contacts',
        fromObjectId: '1',
        toObjectType: 'companies',
        toObjectId: '2',
        associationTypeId: 42,
      });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as {
        inputs: { type: { associationTypeId: number } }[];
      };
      expect(body.inputs[0].type.associationTypeId).toBe(42);
    });
  });

  describe('subscribeWebhook', () => {
    it('throws BadRequestException when appId or privateAppToken missing', async () => {
      // Rebuild service without appId config
      const module2 = await Test.createTestingModule({
        providers: [
          HubspotService,
          OAuthTokenRefreshService,
          { provide: UsersService, useValue: usersService },
          { provide: AuditService, useValue: auditService },
          { provide: ClientsService, useValue: clientsService },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();
      const s2 = module2.get(HubspotService);

      await expect(
        s2.subscribeWebhook({ subscriptionType: 'contact.creation' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls HubSpot webhook subscriptions endpoint', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ id: 'sub-1' }));

      const result = await service.subscribeWebhook({
        subscriptionType: 'contact.creation',
      });
      expect(result).toEqual({ id: 'sub-1' });
    });

    it('includes propertyName when given', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'sub-2' }), { status: 200 }),
      );

      await service.subscribeWebhook({
        subscriptionType: 'contact.propertyChange',
        propertyName: 'email',
      });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as {
        propertyName?: string;
      };
      expect(body.propertyName).toBe('email');
    });

    it('throws HttpException when HubSpot rejects the subscription', async () => {
      mockFetch.mockResolvedValue(
        makeErrorResponse(400, 'Invalid subscription type'),
      );

      await expect(
        service.subscribeWebhook({ subscriptionType: 'bad.type' }),
      ).rejects.toThrow('Invalid subscription type');
    });
  });

  describe('verifyWebhookSignature — no secret configured', () => {
    it('throws when webhookSecret is empty', async () => {
      const module2 = await Test.createTestingModule({
        providers: [
          HubspotService,
          OAuthTokenRefreshService,
          { provide: UsersService, useValue: usersService },
          { provide: AuditService, useValue: auditService },
          { provide: ClientsService, useValue: clientsService },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();
      const s2 = module2.get(HubspotService);

      expect(() => s2.verifyWebhookSignature('[]', 'sig')).toThrow(
        UnauthorizedException,
      );
    });
  });
});
