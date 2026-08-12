import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { writeSseStream } from '../common/realtime/sse-stream.util';
import { AuthEventsService } from './auth-events.service';

type RequestUser = { id: number };

export const HEARTBEAT_MS = 25_000;

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
    const obs$ = this.authEventsService.subscribe(req.user.id);
    writeSseStream(reply, req, obs$, { heartbeatMs: HEARTBEAT_MS });
  }
}
