import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Subscription } from 'rxjs';
import { AuthEventsService } from './auth-events.service';

type RequestUser = { id: number };

const HEARTBEAT_MS = 25_000;

@ApiTags('auth-events')
@Controller('auth')
export class AuthEventsController {
  constructor(private readonly authEventsService: AuthEventsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('events')
  @ApiOperation({
    summary: 'SSE stream of auth events for the authenticated user',
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

    const obs$ = this.authEventsService.subscribe(req.user.id);
    ctx.subscription = obs$.subscribe({
      next: (event) => {
        if (!reply.raw.writable) {
          safeClose();
          return;
        }
        try {
          const ok = reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
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
}
