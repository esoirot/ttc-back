import { Injectable } from '@nestjs/common';

export const OAUTH_REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface OAuthRefreshConfig {
  tokenUrl: string;
  buildBody: (refreshToken: string) => URLSearchParams;
  onFailure: (res: Response) => Promise<never>;
  onSuccess: (tokens: OAuthTokenResponse) => Promise<string>;
}

/**
 * Shared OAuth refresh-token exchange, extracted from HubSpot/Google Calendar's
 * near-identical `getValidToken`/`refreshAccessToken` blocks. Deliberately does
 * NOT decide what a failure/success means for a given provider — `onFailure`
 * and `onSuccess` own that (error message text, invalid_grant handling,
 * whether to overwrite a stored refresh token) so each provider's existing
 * behavior stays exactly as it was, just parameterized instead of duplicated.
 */
@Injectable()
export class OAuthTokenRefreshService {
  private readonly refreshLocks = new Map<string, Promise<string>>();

  refresh(
    lockKey: string,
    refreshToken: string,
    config: OAuthRefreshConfig,
  ): Promise<string> {
    const existing = this.refreshLocks.get(lockKey);
    if (existing) return existing;
    const pending = this.doRefresh(refreshToken, config).finally(() => {
      this.refreshLocks.delete(lockKey);
    });
    this.refreshLocks.set(lockKey, pending);
    return pending;
  }

  private async doRefresh(
    refreshToken: string,
    config: OAuthRefreshConfig,
  ): Promise<string> {
    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: config.buildBody(refreshToken).toString(),
    });
    if (!res.ok) {
      return config.onFailure(res);
    }
    const tokens = (await res.json()) as OAuthTokenResponse;
    return config.onSuccess(tokens);
  }
}
