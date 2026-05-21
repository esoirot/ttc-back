import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { UsersService } from '../users/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ClientsService } from '../clients/clients.service.js';
import type { ClientModel } from '../clients/types/client.type.js';
import { fetchWithRetry } from '../common/retry.util.js';
import type { HubspotContact } from './types/hubspot-contact.type.js';
import type { HubspotCompany } from './types/hubspot-company.type.js';
import type { HubspotDeal } from './types/hubspot-deal.type.js';
import type { HubspotWebhookEvent } from './types/hubspot-webhook.type.js';
import type { CreateContactDto } from './dto/create-contact.dto.js';
import type { UpdateContactDto } from './dto/update-contact.dto.js';
import type { CreateDealDto } from './dto/create-deal.dto.js';
import type { UpdateDealDto } from './dto/update-deal.dto.js';
import type { CreateAssociationDto } from './dto/create-association.dto.js';
import type { SearchObjectsDto } from './dto/search-objects.dto.js';
import type { CreateWebhookSubscriptionDto } from './dto/create-webhook-subscription.dto.js';
import type { CreateCompanyDto } from './dto/create-company.dto.js';
import type { UpdateCompanyDto } from './dto/update-company.dto.js';

const HUBSPOT_BASE = 'https://api.hubapi.com';
const TOKEN_URL = `${HUBSPOT_BASE}/oauth/v1/token`;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type HubspotTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type HubspotTokenInfo = {
  hub_id: number;
};

type HubspotListResponse<T> = {
  results: T[];
  paging?: { next?: { after: string } };
};

type FetchErrorBody = { message?: string };

type OAuthStatePayload = { userId: number; nonce: string; exp: number };
type SignedState = { payload: string; sig: string };

@Injectable()
export class HubspotService {
  private readonly logger = new Logger(HubspotService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;
  private readonly jwtSecret: string;
  private readonly appId: string;
  private readonly privateAppToken: string;
  private readonly refreshLocks = new Map<number, Promise<string>>();

  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
    private readonly clientsService: ClientsService,
  ) {
    this.clientId = this.config.get<string>('HUBSPOT_CLIENT_ID') ?? '';
    this.clientSecret = this.config.get<string>('HUBSPOT_CLIENT_SECRET') ?? '';
    this.redirectUri =
      this.config.get<string>('HUBSPOT_REDIRECT_URI') ??
      'http://localhost:3000/hubspot/auth/callback';
    this.webhookSecret =
      this.config.get<string>('HUBSPOT_WEBHOOK_SECRET') ?? '';
    if (!this.webhookSecret) {
      this.logger.warn(
        'HUBSPOT_WEBHOOK_SECRET not set — webhook signature verification DISABLED',
      );
    }
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    this.jwtSecret = this.config.get<string>('JWT_SECRET') ?? '';
    this.appId = this.config.get<string>('HUBSPOT_APP_ID') ?? '';
    this.privateAppToken =
      this.config.get<string>('HUBSPOT_PRIVATE_APP_TOKEN') ?? '';
  }

  // ─── OAuth state signing (#12) ────────────────────────────────────────────

  private signOAuthState(userId: number): string {
    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + OAUTH_STATE_TTL_MS;
    const payload = JSON.stringify({
      userId,
      nonce,
      exp,
    } satisfies OAuthStatePayload);
    const sig = createHmac('sha256', this.jwtSecret)
      .update(payload)
      .digest('hex');
    return Buffer.from(
      JSON.stringify({ payload, sig } satisfies SignedState),
    ).toString('base64url');
  }

  private verifyOAuthState(state: string): number {
    let parsed: SignedState;
    try {
      parsed = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as SignedState;
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
    const expected = createHmac('sha256', this.jwtSecret)
      .update(parsed.payload)
      .digest('hex');
    const expBuf = Buffer.from(expected, 'hex');
    const recBuf = Buffer.from(parsed.sig, 'hex');
    if (expBuf.length !== recBuf.length || !timingSafeEqual(expBuf, recBuf)) {
      throw new BadRequestException('Invalid OAuth state signature');
    }
    const data = JSON.parse(parsed.payload) as OAuthStatePayload;
    if (Date.now() > data.exp) {
      throw new BadRequestException('OAuth state expired');
    }
    return data.userId;
  }

  // ─── Auth URL / Callback ──────────────────────────────────────────────────

  buildAuthUrl(userId: number): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: [
        'crm.objects.contacts.read',
        'crm.objects.contacts.write',
        'crm.objects.companies.read',
        'crm.objects.deals.read',
        'crm.objects.deals.write',
      ].join(' '),
      state: this.signOAuthState(userId),
    });
    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  get callbackRedirectUrl(): string {
    return `${this.frontendUrl}/hubspot`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const userId = this.verifyOAuthState(state);

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      throw new HttpException('HubSpot token exchange failed', tokenRes.status);
    }

    const tokens = (await tokenRes.json()) as HubspotTokenResponse;

    const infoRes = await fetch(
      `${HUBSPOT_BASE}/oauth/v1/access-tokens/${tokens.access_token}`,
    );
    const info = infoRes.ok
      ? ((await infoRes.json()) as HubspotTokenInfo)
      : null;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await this.usersService.updateHubspot(userId, {
      hubspotAccessToken: tokens.access_token,
      hubspotRefreshToken: tokens.refresh_token,
      hubspotTokenExpiresAt: expiresAt,
      hubspotPortalId: info ? String(info.hub_id) : null,
    });
  }

  // ─── Status / Disconnect ──────────────────────────────────────────────────

  async getStatus(
    userId: number,
  ): Promise<{ connected: boolean; portalId: string | null }> {
    const user = await this.usersService.findOne(userId);
    return {
      connected: !!user.hubspotAccessToken,
      portalId: user.hubspotPortalId ?? null,
    };
  }

  async disconnect(userId: number): Promise<void> {
    const user = await this.usersService.findOne(userId);
    const refreshToken = user.hubspotRefreshToken;

    await this.usersService.updateHubspot(userId, {
      hubspotAccessToken: null,
      hubspotRefreshToken: null,
      hubspotTokenExpiresAt: null,
      hubspotPortalId: null,
    });

    // #14 — revoke refresh token server-side (fire-and-forget)
    if (refreshToken) {
      void fetch(
        `${HUBSPOT_BASE}/oauth/v1/refresh-tokens/${encodeURIComponent(refreshToken)}`,
        { method: 'DELETE' },
      ).catch((err: unknown) => {
        this.logger.warn(`HubSpot token revocation failed: ${String(err)}`);
      });
    }
  }

  // ─── Token management ─────────────────────────────────────────────────────

  private async getValidToken(userId: number): Promise<string> {
    const user = await this.usersService.findOne(userId);
    if (!user.hubspotAccessToken) {
      throw new BadRequestException('HubSpot not connected');
    }
    const expiresAt = user.hubspotTokenExpiresAt;
    if (!expiresAt || expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS) {
      if (!user.hubspotRefreshToken) {
        throw new BadRequestException(
          'HubSpot refresh token missing — reconnect',
        );
      }
      // #11 — coalesce concurrent refresh calls for the same user
      const existing = this.refreshLocks.get(userId);
      if (existing) return existing;
      const p = this.refreshAccessToken(
        userId,
        user.hubspotRefreshToken,
      ).finally(() => {
        this.refreshLocks.delete(userId);
      });
      this.refreshLocks.set(userId, p);
      return p;
    }
    return user.hubspotAccessToken;
  }

  private async refreshAccessToken(
    userId: number,
    refreshToken: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      refresh_token: refreshToken,
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new HttpException('HubSpot token refresh failed', res.status);
    }
    const tokens = (await res.json()) as HubspotTokenResponse;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await this.usersService.updateHubspot(userId, {
      hubspotAccessToken: tokens.access_token,
      hubspotRefreshToken: tokens.refresh_token,
      hubspotTokenExpiresAt: expiresAt,
    });
    return tokens.access_token;
  }

  // ─── Core request helper (#10) ────────────────────────────────────────────

  private async request<T>(
    userId: number,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getValidToken(userId);
    const hasBody = body !== undefined;
    const res = await fetchWithRetry((signal) =>
      fetch(`${HUBSPOT_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
        signal,
      }),
    );

    if (!res.ok) {
      const raw: unknown = await res.json().catch(() => ({}));
      const msg =
        raw !== null &&
        typeof raw === 'object' &&
        'message' in raw &&
        typeof (raw as FetchErrorBody).message === 'string'
          ? (raw as FetchErrorBody).message
          : 'HubSpot API error';
      throw new HttpException(msg ?? 'HubSpot API error', res.status);
    }

    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  async listContacts(
    userId: number,
    after?: string,
    limit = 20,
  ): Promise<HubspotListResponse<HubspotContact>> {
    const params = new URLSearchParams({
      limit: String(limit),
      properties: 'email,firstname,lastname,phone,company',
    });
    if (after) params.set('after', after);
    return this.request<HubspotListResponse<HubspotContact>>(
      userId,
      'GET',
      `/crm/v3/objects/contacts?${params.toString()}`,
    );
  }

  async getContact(userId: number, contactId: string): Promise<HubspotContact> {
    return this.request<HubspotContact>(
      userId,
      'GET',
      `/crm/v3/objects/contacts/${contactId}?properties=email,firstname,lastname,phone,company`,
    );
  }

  async createContact(
    userId: number,
    dto: CreateContactDto,
  ): Promise<HubspotContact> {
    const result = await this.request<HubspotContact>(
      userId,
      'POST',
      '/crm/v3/objects/contacts',
      {
        properties: {
          email: dto.email,
          ...(dto.firstname ? { firstname: dto.firstname } : {}),
          ...(dto.lastname ? { lastname: dto.lastname } : {}),
          ...(dto.phone ? { phone: dto.phone } : {}),
          ...(dto.company ? { company: dto.company } : {}),
        },
      },
    );
    this.auditService.log(
      userId,
      'HUBSPOT_CREATE_CONTACT',
      `hubspot:contacts/${result.id}`,
      dto,
    );
    return result;
  }

  async updateContact(
    userId: number,
    contactId: string,
    dto: UpdateContactDto,
  ): Promise<HubspotContact> {
    const result = await this.request<HubspotContact>(
      userId,
      'PATCH',
      `/crm/v3/objects/contacts/${contactId}`,
      { properties: dto },
    );
    this.auditService.log(
      userId,
      'HUBSPOT_UPDATE_CONTACT',
      `hubspot:contacts/${contactId}`,
      dto,
    );
    return result;
  }

  async searchContacts(
    userId: number,
    dto: SearchObjectsDto,
  ): Promise<HubspotListResponse<HubspotContact>> {
    return this.request<HubspotListResponse<HubspotContact>>(
      userId,
      'POST',
      '/crm/v3/objects/contacts/search',
      {
        ...dto,
        properties: dto.properties ?? [
          'email',
          'firstname',
          'lastname',
          'phone',
          'company',
        ],
      },
    );
  }

  async importContact(userId: number, contactId: string): Promise<ClientModel> {
    const contact = await this.getContact(userId, contactId);
    const p = contact.properties;
    const firstName = (p.firstname ?? '').trim();
    const lastName = (p.lastname ?? '').trim();
    const fullName =
      [firstName, lastName].filter(Boolean).join(' ') ||
      (p.company ?? '').trim() ||
      'Unnamed';
    const result = await this.clientsService.importFromHubspot(
      userId,
      contact.id,
      {
        name: fullName,
        email: p.email?.trim() || undefined,
        phone: p.phone?.trim() || undefined,
        company: p.company?.trim() || undefined,
      },
    );
    this.auditService.log(
      userId,
      'HUBSPOT_IMPORT_CLIENT',
      `hubspot:contacts/${contactId}`,
      { contactId, clientId: result.id, name: result.name },
    );
    return result;
  }

  // ─── Companies ────────────────────────────────────────────────────────────

  async listCompanies(
    userId: number,
    after?: string,
    limit = 20,
  ): Promise<HubspotListResponse<HubspotCompany>> {
    const params = new URLSearchParams({
      limit: String(limit),
      properties: 'name,domain,phone',
    });
    if (after) params.set('after', after);
    return this.request<HubspotListResponse<HubspotCompany>>(
      userId,
      'GET',
      `/crm/v3/objects/companies?${params.toString()}`,
    );
  }

  async getCompany(userId: number, companyId: string): Promise<HubspotCompany> {
    return this.request<HubspotCompany>(
      userId,
      'GET',
      `/crm/v3/objects/companies/${companyId}?properties=name,domain,phone,city,country`,
    );
  }

  async createCompany(
    userId: number,
    dto: CreateCompanyDto,
  ): Promise<HubspotCompany> {
    const result = await this.request<HubspotCompany>(
      userId,
      'POST',
      '/crm/v3/objects/companies',
      {
        properties: {
          name: dto.name,
          ...(dto.domain ? { domain: dto.domain } : {}),
          ...(dto.phone ? { phone: dto.phone } : {}),
          ...(dto.city ? { city: dto.city } : {}),
          ...(dto.country ? { country: dto.country } : {}),
        },
      },
    );
    this.auditService.log(
      userId,
      'HUBSPOT_CREATE_COMPANY',
      `hubspot:companies/${result.id}`,
      dto,
    );
    return result;
  }

  async updateCompany(
    userId: number,
    companyId: string,
    dto: UpdateCompanyDto,
  ): Promise<HubspotCompany> {
    const result = await this.request<HubspotCompany>(
      userId,
      'PATCH',
      `/crm/v3/objects/companies/${companyId}`,
      { properties: dto },
    );
    this.auditService.log(
      userId,
      'HUBSPOT_UPDATE_COMPANY',
      `hubspot:companies/${companyId}`,
      dto,
    );
    return result;
  }

  async searchCompanies(
    userId: number,
    dto: SearchObjectsDto,
  ): Promise<HubspotListResponse<HubspotCompany>> {
    return this.request<HubspotListResponse<HubspotCompany>>(
      userId,
      'POST',
      '/crm/v3/objects/companies/search',
      {
        ...dto,
        properties: dto.properties ?? ['name', 'domain', 'phone'],
      },
    );
  }

  // ─── Deals ────────────────────────────────────────────────────────────────

  async listDeals(
    userId: number,
    after?: string,
    limit = 20,
  ): Promise<HubspotListResponse<HubspotDeal>> {
    const params = new URLSearchParams({
      limit: String(limit),
      properties: 'dealname,amount,dealstage,pipeline,closedate',
    });
    if (after) params.set('after', after);
    return this.request<HubspotListResponse<HubspotDeal>>(
      userId,
      'GET',
      `/crm/v3/objects/deals?${params.toString()}`,
    );
  }

  async getDeal(userId: number, dealId: string): Promise<HubspotDeal> {
    return this.request<HubspotDeal>(
      userId,
      'GET',
      `/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,pipeline,closedate`,
    );
  }

  async createDeal(userId: number, dto: CreateDealDto): Promise<HubspotDeal> {
    const result = await this.request<HubspotDeal>(
      userId,
      'POST',
      '/crm/v3/objects/deals',
      {
        properties: {
          dealname: dto.dealname,
          ...(dto.amount ? { amount: dto.amount } : {}),
          ...(dto.dealstage ? { dealstage: dto.dealstage } : {}),
          ...(dto.pipeline ? { pipeline: dto.pipeline } : {}),
          ...(dto.closedate ? { closedate: dto.closedate } : {}),
        },
      },
    );
    this.auditService.log(
      userId,
      'HUBSPOT_CREATE_DEAL',
      `hubspot:deals/${result.id}`,
      dto,
    );
    return result;
  }

  async updateDeal(
    userId: number,
    dealId: string,
    dto: UpdateDealDto,
  ): Promise<HubspotDeal> {
    const result = await this.request<HubspotDeal>(
      userId,
      'PATCH',
      `/crm/v3/objects/deals/${dealId}`,
      { properties: dto },
    );
    this.auditService.log(
      userId,
      'HUBSPOT_UPDATE_DEAL',
      `hubspot:deals/${dealId}`,
      dto,
    );
    return result;
  }

  async searchDeals(
    userId: number,
    dto: SearchObjectsDto,
  ): Promise<HubspotListResponse<HubspotDeal>> {
    return this.request<HubspotListResponse<HubspotDeal>>(
      userId,
      'POST',
      '/crm/v3/objects/deals/search',
      {
        ...dto,
        properties: dto.properties ?? [
          'dealname',
          'amount',
          'dealstage',
          'pipeline',
          'closedate',
        ],
      },
    );
  }

  // ─── Associations (#6) ────────────────────────────────────────────────────

  async createAssociation(
    userId: number,
    dto: CreateAssociationDto,
  ): Promise<void> {
    const typeId =
      dto.associationTypeId ??
      defaultAssociationTypeId(dto.fromObjectType, dto.toObjectType);
    await this.request<unknown>(
      userId,
      'PUT',
      `/crm/v3/associations/${dto.fromObjectType}/${dto.toObjectType}/batch/create`,
      {
        inputs: [
          {
            from: { id: dto.fromObjectId },
            to: { id: dto.toObjectId },
            type: {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: typeId,
            },
          },
        ],
      },
    );
    this.auditService.log(
      userId,
      'HUBSPOT_CREATE_ASSOCIATION',
      `hubspot:associations/${dto.fromObjectType}/${dto.fromObjectId}->${dto.toObjectType}/${dto.toObjectId}`,
    );
  }

  // ─── Admin: connections overview ──────────────────────────────────────────

  async listConnections(): Promise<
    {
      userId: number;
      email: string;
      connected: boolean;
      portalId: string | null;
      expiresAt: Date | null;
    }[]
  > {
    const users = await this.usersService.findAll();
    return users.map((u) => ({
      userId: u.id,
      email: u.email,
      connected: !!u.hubspotAccessToken,
      portalId: u.hubspotPortalId ?? null,
      expiresAt: u.hubspotTokenExpiresAt ?? null,
    }));
  }

  // ─── Webhook management (#9) ──────────────────────────────────────────────

  async subscribeWebhook(dto: CreateWebhookSubscriptionDto): Promise<unknown> {
    if (!this.appId || !this.privateAppToken) {
      throw new BadRequestException(
        'HUBSPOT_APP_ID and HUBSPOT_PRIVATE_APP_TOKEN must be set',
      );
    }
    const res = await fetchWithRetry((signal) =>
      fetch(`${HUBSPOT_BASE}/webhooks/v3/${this.appId}/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.privateAppToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: dto.subscriptionType,
          ...(dto.propertyName ? { propertyName: dto.propertyName } : {}),
        }),
        signal,
      }),
    );
    if (!res.ok) {
      const raw: unknown = await res.json().catch(() => ({}));
      const msg =
        raw !== null &&
        typeof raw === 'object' &&
        'message' in raw &&
        typeof (raw as FetchErrorBody).message === 'string'
          ? ((raw as FetchErrorBody).message ??
            'HubSpot webhook subscription failed')
          : 'HubSpot webhook subscription failed';
      throw new HttpException(msg, res.status);
    }
    return res.json() as Promise<unknown>;
  }

  // ─── Webhooks (#8 + #13) ──────────────────────────────────────────────────

  verifyWebhookSignature(
    rawBody: string,
    signature: string,
    timestampMs?: number,
  ): void {
    // #13 — replay protection
    if (timestampMs !== undefined && Date.now() - timestampMs > 5 * 60 * 1000) {
      throw new UnauthorizedException('Stale webhook request');
    }

    if (!this.webhookSecret) {
      throw new UnauthorizedException(
        'Webhook signature verification disabled — HUBSPOT_WEBHOOK_SECRET not configured',
      );
    }
    const expected = createHash('sha256')
      .update(this.webhookSecret + rawBody)
      .digest();
    const received = Buffer.from(signature, 'hex');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  handleWebhookEvents(events: HubspotWebhookEvent[]): void {
    for (const event of events) {
      this.dispatchEvent(event);
    }
  }

  private dispatchEvent(event: HubspotWebhookEvent): void {
    this.logger.log({
      message: 'HubSpot webhook event',
      subscriptionType: event.subscriptionType,
      objectId: event.objectId,
      portalId: event.portalId,
      eventId: event.eventId,
    });
    void this.handleEvent(event).catch((err: unknown) => {
      this.logger.error(
        `Webhook handler error [${event.subscriptionType}]`,
        String(err),
      );
    });
  }

  private async handleEvent(event: HubspotWebhookEvent): Promise<void> {
    const hubspotId = String(event.objectId);
    switch (event.subscriptionType) {
      case 'contact.propertyChange': {
        const client =
          await this.clientsService.findByHubspotIdGlobal(hubspotId);
        if (!client) break;
        const FIELD_MAP: Record<string, string> = {
          email: 'email',
          phone: 'phone',
          company: 'company',
        };
        const field = event.propertyName
          ? FIELD_MAP[event.propertyName]
          : undefined;
        if (!field || event.propertyValue === undefined) break;
        await this.clientsService.update(client.id, client.userId, {
          id: client.id,
          [field]: event.propertyValue,
        });
        break;
      }
      default:
        break;
    }
  }
}

function defaultAssociationTypeId(fromType: string, toType: string): number {
  if (fromType === 'contacts' && toType === 'companies') return 1;
  if (fromType === 'contacts' && toType === 'deals') return 4;
  if (fromType === 'companies' && toType === 'contacts') return 2;
  if (fromType === 'deals' && toType === 'contacts') return 3;
  throw new BadRequestException(
    `No default associationTypeId for ${fromType} → ${toType}. Provide associationTypeId explicitly.`,
  );
}
