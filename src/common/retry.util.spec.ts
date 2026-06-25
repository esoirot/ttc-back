import { fetchWithRetry } from './retry.util';

const makeResponse = (
  status: number,
  headers: Record<string, string> = {},
): Response =>
  ({
    status,
    headers: {
      get: (key: string) => headers[key] ?? null,
    } as unknown as Headers,
  }) as unknown as Response;

describe('fetchWithRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns response immediately on success', async () => {
    const fn = jest.fn().mockResolvedValue(makeResponse(200));

    const promise = fetchWithRetry(fn, 3, 100);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns non-429 error response without retrying', async () => {
    const fn = jest.fn().mockResolvedValue(makeResponse(500));

    const promise = fetchWithRetry(fn, 3, 100);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and returns success on next attempt', async () => {
    const fn = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(429))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = fetchWithRetry(fn, 3, 0);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops retrying after maxRetries and returns last 429', async () => {
    const fn = jest.fn().mockResolvedValue(makeResponse(429));

    const promise = fetchWithRetry(fn, 2, 0);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(429);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('uses Retry-After header delay when present', async () => {
    const fn = jest
      .fn()
      .mockResolvedValueOnce(makeResponse(429, { 'Retry-After': '5' }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = fetchWithRetry(fn, 3, 100);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
