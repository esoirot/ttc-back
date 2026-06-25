import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { HubspotService } from './hubspot.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { ClientsService } from '../clients/clients.service';
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
      FRONTEND_URL: 'http://localhost:5173',
      JWT_SECRET,
      HUBSPOT_APP_ID: 'app-123',
      HUBSPOT_PRIVATE_APP_TOKEN: 'papp-token',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HubspotService,
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
    jest.clearAllMocks();
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
    it('nulls all hubspot fields', async () => {
      await service.disconnect(1);
      expect(usersService.updateHubspot).toHaveBeenCalledWith(1, {
        hubspotAccessToken: null,
        hubspotRefreshToken: null,
        hubspotTokenExpiresAt: null,
        hubspotPortalId: null,
      });
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
  });

  describe('verifyWebhookSignature', () => {
    const rawBody = '[]';
    const validSig = createHash('sha256')
      .update(WEBHOOK_SECRET + rawBody)
      .digest('hex');

    it('passes for valid signature', () => {
      expect(() =>
        service.verifyWebhookSignature(rawBody, validSig),
      ).not.toThrow();
    });

    it('throws UnauthorizedException for stale request (replay protection)', () => {
      const staleTs = Date.now() - 6 * 60 * 1000; // 6 min ago
      expect(() =>
        service.verifyWebhookSignature(rawBody, validSig, staleTs),
      ).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for invalid signature', () => {
      expect(() =>
        service.verifyWebhookSignature(rawBody, 'a'.repeat(64)),
      ).toThrow(UnauthorizedException);
    });

    it('recent timestamp passes replay check', () => {
      const recentTs = Date.now() - 60 * 1000; // 1 min ago
      expect(() =>
        service.verifyWebhookSignature(rawBody, validSig, recentTs),
      ).not.toThrow();
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
  });

  describe('deals CRUD', () => {
    it('listDeals — delegates to request', async () => {
      mockFetch.mockResolvedValue(makeOkResponse({ results: [] }));
      await service.listDeals(1);
      expect(mockFetch).toHaveBeenCalled();
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
  });

  describe('subscribeWebhook', () => {
    it('throws BadRequestException when appId or privateAppToken missing', async () => {
      // Rebuild service without appId config
      const module2 = await Test.createTestingModule({
        providers: [
          HubspotService,
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
  });

  describe('verifyWebhookSignature — no secret configured', () => {
    it('throws when webhookSecret is empty', async () => {
      const module2 = await Test.createTestingModule({
        providers: [
          HubspotService,
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
