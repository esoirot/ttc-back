import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Observable, Subscription } from 'rxjs';

const DEFAULT_HEARTBEAT_MS = 25_000;

interface WriteSseStreamOptions {
  heartbeatMs?: number;
}

/**
 * Turns an Observable into an SSE HTTP response on a hijacked Fastify reply:
 * headers, a `connected` preamble, per-value `data:` frames, a heartbeat
 * comment on an interval, and cleanup on backpressure/error/complete/close.
 * Extracted from timer-events/auth-events controllers, which duplicated this
 * byte-for-byte — each still owns its own Observable (channel naming, payload
 * shape), this only owns writing it out as SSE.
 */
export function writeSseStream<T>(
  reply: FastifyReply,
  req: FastifyRequest,
  obs$: Observable<T>,
  opts: WriteSseStreamOptions = {},
): void {
  const heartbeatMs = opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;

  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin':
      process.env.FRONTEND_URL ?? 'http://localhost:5173',
    'Access-Control-Allow-Credentials': 'true',
  });
  reply.raw.flushHeaders();
  reply.raw.write(`data: {"type":"connected"}\n\n`);

  // Single mutable context object keeps all close-path state on a const reference.
  // All close paths funnel through safeClose — idempotent, prevents double-cleanup.
  const ctx: {
    closed: boolean;
    heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    subscription: Subscription | undefined;
  } = { closed: false, heartbeatTimer: undefined, subscription: undefined };

  const safeClose = () => {
    if (ctx.closed) return;
    ctx.closed = true;

    if (ctx.heartbeatTimer) clearInterval(ctx.heartbeatTimer);
    ctx.subscription?.unsubscribe();
    ctx.subscription = undefined;

    reply.raw.end();
  };

  ctx.subscription = obs$.subscribe({
    next: (value) => {
      if (!reply.raw.writable) {
        safeClose();
        return;
      }
      try {
        // write() returns false when the kernel buffer is full (backpressure).
        // These events are infrequent, so force-close rather than buffer — client reconnects.
        const ok = reply.raw.write(`data: ${JSON.stringify(value)}\n\n`);
        if (!ok) safeClose();
      } catch {
        safeClose();
      }
    },
    error: () => safeClose(),
    complete: () => safeClose(),
  });

  // Skip scheduling if subscribe() above already closed synchronously
  // (e.g. the observable errors immediately) — otherwise the interval leaks
  // past the already-torn-down connection until its own writable-check fires.
  if (!ctx.closed) {
    ctx.heartbeatTimer = setInterval(() => {
      if (!reply.raw.writable) {
        safeClose();
        return;
      }
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        safeClose();
      }
    }, heartbeatMs);
  }

  req.raw.on('close', safeClose);
  req.raw.on('error', () => safeClose());
}
