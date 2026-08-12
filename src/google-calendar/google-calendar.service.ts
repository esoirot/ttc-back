import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { fetchWithRetry } from '../common/retry.util.js';
import {
  OAuthTokenRefreshService,
  OAUTH_REFRESH_MARGIN_MS,
} from '../common/oauth-token/oauth-token-refresh.service.js';
import {
  signOAuthState,
  verifyOAuthState,
} from '../common/oauth-state.util.js';
import type { CreateGoogleCalendarEventDto } from './dto/create-google-calendar-event.dto.js';
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventList,
} from './types/google-calendar-event.type.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type GoogleUserInfo = {
  email?: string;
};

type FetchErrorBody = { error?: { message?: string } };

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly frontendUrl: string;
  private readonly jwtSecret: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
    private readonly oauthTokenRefreshService: OAuthTokenRefreshService,
  ) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.redirectUri =
      this.config.get<string>('GOOGLE_CALENDAR_REDIRECT_URI') ??
      'http://localhost:3000/google-calendar/auth/callback';
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    this.jwtSecret = this.config.get<string>('JWT_SECRET') ?? '';
  }

  // ─── OAuth state signing ───────────────────────────────────────────────────

  private signOAuthState(userId: number): string {
    return signOAuthState(this.jwtSecret, { userId }, OAUTH_STATE_TTL_MS);
  }

  private verifyOAuthState(state: string): number {
    return verifyOAuthState<{ userId: number }>(this.jwtSecret, state).userId;
  }

  // ─── Auth URL / Callback ────────────────────────────────────────────────────

  buildAuthUrl(userId: number): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope:
        'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state: this.signOAuthState(userId),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  get callbackRedirectUrl(): string {
    return `${this.frontendUrl}/google-calendar`;
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
      throw new HttpException(
        'Google Calendar token exchange failed',
        tokenRes.status,
      );
    }

    const tokens = (await tokenRes.json()) as GoogleTokenResponse;

    const infoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = infoRes.ok ? ((await infoRes.json()) as GoogleUserInfo) : null;

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await this.usersService.updateGoogleCalendar(userId, {
      googleCalendarAccessToken: tokens.access_token,
      googleCalendarRefreshToken: tokens.refresh_token ?? null,
      googleCalendarTokenExpiresAt: expiresAt,
      googleCalendarEmail: info?.email ?? null,
    });
  }

  // ─── Status / Disconnect ────────────────────────────────────────────────────

  async getStatus(
    userId: number,
  ): Promise<{ connected: boolean; email: string | null }> {
    const user = await this.usersService.findOne(userId);
    return {
      connected: !!user.googleCalendarAccessToken,
      email: user.googleCalendarEmail ?? null,
    };
  }

  async disconnect(userId: number): Promise<void> {
    const user = await this.usersService.findOne(userId);
    const refreshToken = user.googleCalendarRefreshToken;

    await this.usersService.updateGoogleCalendar(userId, {
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpiresAt: null,
      googleCalendarEmail: null,
    });

    this.auditService.log(
      userId,
      'GOOGLE_CALENDAR_DISCONNECT',
      `google-calendar:connections/${userId}`,
    );

    if (refreshToken) {
      void fetch(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
      }).catch((err: unknown) => {
        this.logger.warn(
          `Google Calendar token revocation failed: ${String(err)}`,
        );
      });
    }
  }

  // ─── Token management ───────────────────────────────────────────────────────

  private async getValidToken(userId: number): Promise<string> {
    const user = await this.usersService.findOne(userId);
    if (!user.googleCalendarAccessToken) {
      throw new BadRequestException('Google Calendar not connected');
    }
    const expiresAt = user.googleCalendarTokenExpiresAt;
    if (
      !expiresAt ||
      expiresAt.getTime() - Date.now() < OAUTH_REFRESH_MARGIN_MS
    ) {
      if (!user.googleCalendarRefreshToken) {
        throw new BadRequestException(
          'Google Calendar refresh token missing — reconnect',
        );
      }
      return this.oauthTokenRefreshService.refresh(
        `google-calendar:${userId}`,
        user.googleCalendarRefreshToken,
        {
          tokenUrl: TOKEN_URL,
          buildBody: (refreshToken) =>
            new URLSearchParams({
              grant_type: 'refresh_token',
              client_id: this.clientId,
              client_secret: this.clientSecret,
              refresh_token: refreshToken,
            }),
          onFailure: async (res) => {
            if (res.status === 400) {
              // invalid_grant: refresh token expired/revoked — clear stored
              // credentials so getStatus reports disconnected and the frontend
              // prompts reconnect, instead of retrying the same dead token forever.
              await this.usersService.updateGoogleCalendar(userId, {
                googleCalendarAccessToken: null,
                googleCalendarRefreshToken: null,
                googleCalendarTokenExpiresAt: null,
              });
            }
            throw new HttpException(
              'Google Calendar refresh token invalid — reconnect',
              res.status,
            );
          },
          onSuccess: async (tokens) => {
            const newExpiresAt = new Date(
              Date.now() + tokens.expires_in * 1000,
            );
            // Google does not always return a new refresh_token on refresh —
            // only overwrite the stored one when a new one is actually issued,
            // otherwise the still-valid existing refresh token would be wiped.
            await this.usersService.updateGoogleCalendar(userId, {
              googleCalendarAccessToken: tokens.access_token,
              googleCalendarTokenExpiresAt: newExpiresAt,
              ...(tokens.refresh_token
                ? { googleCalendarRefreshToken: tokens.refresh_token }
                : {}),
            });
            return tokens.access_token;
          },
        },
      );
    }
    return user.googleCalendarAccessToken;
  }

  // ─── Core request helper ────────────────────────────────────────────────────

  private async request<T>(
    userId: number,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getValidToken(userId);
    const hasBody = body !== undefined;
    const res = await fetchWithRetry((signal) =>
      fetch(`${CALENDAR_BASE}${path}`, {
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
        'error' in raw &&
        typeof (raw as FetchErrorBody).error?.message === 'string'
          ? (raw as FetchErrorBody).error?.message
          : 'Google Calendar API error';
      throw new HttpException(msg ?? 'Google Calendar API error', res.status);
    }

    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  }

  // ─── Events ──────────────────────────────────────────────────────────────────

  async listEvents(
    userId: number,
    timeMin: string,
    timeMax: string,
  ): Promise<GoogleCalendarEventList> {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    return this.request<GoogleCalendarEventList>(
      userId,
      'GET',
      `/calendars/primary/events?${params.toString()}`,
    );
  }

  async createEvent(
    userId: number,
    dto: CreateGoogleCalendarEventDto,
  ): Promise<GoogleCalendarEvent> {
    const result = await this.request<GoogleCalendarEvent>(
      userId,
      'POST',
      '/calendars/primary/events',
      {
        summary: dto.summary,
        start: { dateTime: dto.startDateTime },
        end: { dateTime: dto.endDateTime },
      },
    );
    this.auditService.log(
      userId,
      'GOOGLE_CALENDAR_CREATE_EVENT',
      `google-calendar:events/${result.id}`,
      dto,
    );
    return result;
  }
}
