import { OAuthTokenRefreshService } from './oauth-token-refresh.service';

const makeConfig = (
  overrides: Partial<Parameters<OAuthTokenRefreshService['refresh']>[2]> = {},
) => ({
  tokenUrl: 'https://provider.example/token',
  buildBody: (refreshToken: string) =>
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  onFailure: jest.fn((res: Response) => {
    throw new Error(`refresh failed: ${res.status}`);
  }),
  onSuccess: jest.fn((tokens: { access_token: string }) =>
    Promise.resolve(tokens.access_token),
  ),
  ...overrides,
});

describe('OAuthTokenRefreshService', () => {
  let service: OAuthTokenRefreshService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new OAuthTokenRefreshService();
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('posts to tokenUrl with the built body and resolves via onSuccess on a 2xx response', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ access_token: 'new-token', expires_in: 3600 }),
    });
    const config = makeConfig();

    const result = await service.refresh(
      'provider:1',
      'old-refresh-token',
      config,
    );

    expect(result).toBe('new-token');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://provider.example/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=old-refresh-token',
      }),
    );
    expect(config.onSuccess).toHaveBeenCalledWith({
      access_token: 'new-token',
      expires_in: 3600,
    });
  });

  it('delegates to onFailure and propagates its rejection on a non-2xx response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });
    const config = makeConfig();

    await expect(
      service.refresh('provider:1', 'old-refresh-token', config),
    ).rejects.toThrow('refresh failed: 401');
    expect(config.onFailure).toHaveBeenCalled();
    expect(config.onSuccess).not.toHaveBeenCalled();
  });

  it('coalesces concurrent refresh() calls for the same lock key into a single fetch', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchSpy.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const config = makeConfig();

    const p1 = service.refresh('provider:1', 'ref-a', config);
    const p2 = service.refresh('provider:1', 'ref-a', config);

    resolveFetch({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ access_token: 'shared-token', expires_in: 3600 }),
    } as Response);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('shared-token');
    expect(r2).toBe('shared-token');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not coalesce refresh() calls with different lock keys', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }),
    });
    const config = makeConfig();

    await Promise.all([
      service.refresh('provider:1', 'ref-a', config),
      service.refresh('provider:2', 'ref-b', config),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('releases the lock after completion, so a later call for the same key fetches again', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }),
    });
    const config = makeConfig();

    await service.refresh('provider:1', 'ref-a', config);
    await service.refresh('provider:1', 'ref-a', config);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
