import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Subscription } from 'rxjs';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  TimerEventsService,
  type TimerEventsStats,
} from './timer-events.service';

type RequestUser = { id: number };

// Heartbeat interval — keeps connection alive through LB/proxy idle timeouts.
const HEARTBEAT_MS = 25_000;

@ApiTags('timer-events')
@Controller('timer')
export class TimerEventsController {
  constructor(private readonly timerEventsService: TimerEventsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('events')
  @ApiOperation({
    summary: 'SSE stream of timer state changes for the authenticated user',
  })
  sseEvents(
    @Req() req: FastifyRequest & { user: RequestUser },
    @Res() reply: FastifyReply,
  ): void {
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

    const obs$ = this.timerEventsService.subscribe(req.user.id);
    ctx.subscription = obs$.subscribe({
      next: (entry) => {
        if (!reply.raw.writable) {
          safeClose();
          return;
        }
        try {
          // write() returns false when the kernel buffer is full (backpressure).
          // Timer events are infrequent, so force-close rather than buffer — client reconnects.
          const ok = reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
          if (!ok) safeClose();
        } catch {
          safeClose();
        }
      },
      error: () => safeClose(),
      complete: () => safeClose(),
    });

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
    }, HEARTBEAT_MS);

    req.raw.on('close', safeClose);
    req.raw.on('error', () => safeClose());
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Get('stats')
  @ApiOperation({ summary: 'Active SSE channel stats (admin only)' })
  getStats(): TimerEventsStats {
    return this.timerEventsService.getStats();
  }
}
