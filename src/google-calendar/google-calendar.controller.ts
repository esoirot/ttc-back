import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';
import type { RequestUser } from '../auth/types/gql-context.type.js';
import { GoogleCalendarService } from './google-calendar.service.js';
import type { CreateGoogleCalendarEventDto } from './dto/create-google-calendar-event.dto.js';

type AuthRequest = FastifyRequest & { user: RequestUser };

@ApiTags('google-calendar')
@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(private readonly googleCalendar: GoogleCalendarService) {}

  @Get('auth')
  @UseGuards(AuthGuard('jwt'))
  @Redirect()
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Start Google Calendar OAuth — redirects to Google',
  })
  initiateOAuth(@Req() req: AuthRequest) {
    return {
      url: this.googleCalendar.buildAuthUrl(req.user.id),
      statusCode: 302,
    };
  }

  @Get('auth/callback')
  @Redirect()
  @ApiExcludeEndpoint() // Google-invoked redirect target, not called directly by API clients
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    await this.googleCalendar.handleCallback(code, state);
    return { url: this.googleCalendar.callbackRedirectUrl, statusCode: 302 };
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Connection status — is Google Calendar connected' })
  getStatus(@Req() req: AuthRequest) {
    return this.googleCalendar.getStatus(req.user.id);
  }

  @Delete('disconnect')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(204)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Disconnect — revoke stored Google Calendar token' })
  disconnect(@Req() req: AuthRequest) {
    return this.googleCalendar.disconnect(req.user.id);
  }

  @Get('events')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List events in a time range (ISO 8601 bounds)' })
  @ApiQuery({ name: 'timeMin', required: true })
  @ApiQuery({ name: 'timeMax', required: true })
  listEvents(
    @Req() req: AuthRequest,
    @Query('timeMin') timeMin: string,
    @Query('timeMax') timeMax: string,
  ) {
    return this.googleCalendar.listEvents(req.user.id, timeMin, timeMax);
  }

  @Post('events')
  @UseGuards(AuthGuard('jwt'))
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Create an event on the primary calendar' })
  createEvent(
    @Req() req: AuthRequest,
    @Body() dto: CreateGoogleCalendarEventDto,
  ) {
    return this.googleCalendar.createEvent(req.user.id, dto);
  }
}
