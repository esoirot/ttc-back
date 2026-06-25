import { Test, TestingModule } from '@nestjs/testing';
import { HubspotController } from './hubspot.controller';
import { HubspotService } from './hubspot.service';
import type { HubspotWebhookEvent } from './types/hubspot-webhook.type';

type AuthRequest = Parameters<HubspotController['getStatus']>[0];
type RawBodyRequest = Parameters<HubspotController['handleWebhook']>[0];

const makeReq = (userId = 1) =>
  ({
    user: { id: userId, email: 'u@e.com', role: 'USER' },
  }) as unknown as AuthRequest;

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

describe('HubspotController', () => {
  let controller: HubspotController;
  let service: Record<string, jest.Mock | string>;

  beforeEach(async () => {
    service = {
      buildAuthUrl: jest
        .fn()
        .mockReturnValue('https://app.hubspot.com/oauth/authorize?...'),
      handleCallback: jest.fn().mockResolvedValue(undefined),
      callbackRedirectUrl: 'http://localhost:5173/hubspot',
      getStatus: jest
        .fn()
        .mockResolvedValue({ connected: true, portalId: 'p1' }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      listContacts: jest.fn().mockResolvedValue({ results: [] }),
      searchContacts: jest.fn().mockResolvedValue({ results: [] }),
      getContact: jest.fn().mockResolvedValue({ id: 'c1', properties: {} }),
      createContact: jest
        .fn()
        .mockResolvedValue({ id: 'c-new', properties: {} }),
      updateContact: jest.fn().mockResolvedValue({ id: 'c1', properties: {} }),
      importContact: jest.fn().mockResolvedValue({ id: 5, name: 'Bob' }),
      listCompanies: jest.fn().mockResolvedValue({ results: [] }),
      searchCompanies: jest.fn().mockResolvedValue({ results: [] }),
      createCompany: jest
        .fn()
        .mockResolvedValue({ id: 'co-1', properties: {} }),
      getCompany: jest.fn().mockResolvedValue({ id: 'co-1', properties: {} }),
      updateCompany: jest
        .fn()
        .mockResolvedValue({ id: 'co-1', properties: {} }),
      listDeals: jest.fn().mockResolvedValue({ results: [] }),
      searchDeals: jest.fn().mockResolvedValue({ results: [] }),
      getDeal: jest.fn().mockResolvedValue({ id: 'd1', properties: {} }),
      createDeal: jest.fn().mockResolvedValue({ id: 'd-new', properties: {} }),
      updateDeal: jest.fn().mockResolvedValue({ id: 'd1', properties: {} }),
      createAssociation: jest.fn().mockResolvedValue(undefined),
      listConnections: jest.fn().mockResolvedValue([]),
      subscribeWebhook: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      verifyWebhookSignature: jest.fn(),
      handleWebhookEvents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HubspotController],
      providers: [{ provide: HubspotService, useValue: service }],
    }).compile();

    controller = module.get(HubspotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('initiateOAuth — returns redirect URL', () => {
    const result = controller.initiateOAuth(makeReq());
    expect(service.buildAuthUrl).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ statusCode: 302 });
  });

  it('oauthCallback — calls handleCallback and redirects', async () => {
    const result = await controller.oauthCallback('code-abc', 'state-xyz');
    expect(service.handleCallback).toHaveBeenCalledWith(
      'code-abc',
      'state-xyz',
    );
    expect(result).toMatchObject({ statusCode: 302 });
  });

  it('getStatus — delegates with userId', async () => {
    await controller.getStatus(makeReq());
    expect(service.getStatus).toHaveBeenCalledWith(1);
  });

  it('disconnect — delegates with userId', async () => {
    await controller.disconnect(makeReq());
    expect(service.disconnect).toHaveBeenCalledWith(1);
  });

  it('listContacts — passes optional pagination params', async () => {
    await controller.listContacts(makeReq(), 'cursor-1', '10');
    expect(service.listContacts).toHaveBeenCalledWith(1, 'cursor-1', 10);
  });

  it('createContact — passes dto', async () => {
    const dto = { email: 'x@y.com' };
    await controller.createContact(makeReq(), dto);
    expect(service.createContact).toHaveBeenCalledWith(1, dto);
  });

  it('updateContact — passes id and dto', async () => {
    const dto = { email: 'new@y.com' };
    await controller.updateContact(makeReq(), 'c-42', dto);
    expect(service.updateContact).toHaveBeenCalledWith(1, 'c-42', dto);
  });

  it('importContact — passes contactId', async () => {
    await controller.importContact(makeReq(), 'c-42');
    expect(service.importContact).toHaveBeenCalledWith(1, 'c-42');
  });

  it('createDeal — passes dto', async () => {
    const dto = { dealname: 'Big Deal' };
    await controller.createDeal(makeReq(), dto);
    expect(service.createDeal).toHaveBeenCalledWith(1, dto);
  });

  it('createAssociation — passes dto', async () => {
    const dto = {
      fromObjectType: 'contacts',
      fromObjectId: '1',
      toObjectType: 'companies',
      toObjectId: '2',
    };
    await controller.createAssociation(makeReq(), dto);
    expect(service.createAssociation).toHaveBeenCalledWith(1, dto);
  });

  it('listConnections — delegates (no userId needed)', async () => {
    await controller.listConnections();
    expect(service.listConnections).toHaveBeenCalled();
  });

  it('forceDisconnect — passes userId param', async () => {
    await controller.forceDisconnect(99);
    expect(service.disconnect).toHaveBeenCalledWith(99);
  });

  it('handleWebhook — verifies signature then dispatches events', () => {
    const req = { rawBody: '[]' } as unknown as RawBodyRequest;
    const body: HubspotWebhookEvent[] = [];
    controller.handleWebhook(req, body, 'sig-abc', '1234567890');
    expect(service.verifyWebhookSignature).toHaveBeenCalledWith(
      '[]',
      'sig-abc',
      1234567890,
    );
    expect(service.handleWebhookEvents).toHaveBeenCalledWith(body);
  });

  it('handleWebhook — uses JSON.stringify(body) when no rawBody', () => {
    const req = {} as unknown as RawBodyRequest;
    const body = [makeWebhookEvent({ eventId: 1 })];
    controller.handleWebhook(req, body, 'sig', '');
    expect(service.verifyWebhookSignature).toHaveBeenCalledWith(
      JSON.stringify(body),
      'sig',
      undefined,
    );
  });
});
