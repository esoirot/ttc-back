import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { writeSseStream } from '../common/realtime/sse-stream.util';
import {
  TimerEventsService,
  type TimerEventsStats,
} from './timer-events.service';

type RequestUser = { id: number };

// Heartbeat interval — keeps connection alive through LB/proxy idle timeouts.
export const HEARTBEAT_MS = 25_000;

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
    const obs$ = this.timerEventsService.subscribe(req.user.id);
    writeSseStream(reply, req, obs$, { heartbeatMs: HEARTBEAT_MS });
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @Get('stats')
  @ApiOperation({ summary: 'Active SSE channel stats (admin only)' })
  getStats(): TimerEventsStats {
    return this.timerEventsService.getStats();
  }
}
