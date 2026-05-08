export async function fetchWithRetry(
  fn: () => Promise<Response>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<Response> {
  let res!: Response;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    res = await fn();
    if (res.status !== 429 || attempt === maxRetries) return res;
    const retryAfterHeader = res.headers.get('Retry-After');
    const delay = retryAfterHeader
      ? parseInt(retryAfterHeader, 10) * 1000
      : baseDelayMs * 2 ** attempt;
    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(delay, 30_000)),
    );
  }
  return res;
}
