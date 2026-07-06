import { Controller, Get, Redirect, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { GoogleProfile } from './strategies/google.strategy';
import {
  GoogleInitiateGuard,
  GoogleCallbackGuard,
} from './guards/google-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(GoogleInitiateGuard)
  @ApiOperation({
    summary: 'Start Google OAuth — redirects to Google consent screen',
  })
  googleLogin() {
    // Guard redirects to Google — nothing to return
  }

  @Get('google/callback')
  @UseGuards(GoogleCallbackGuard)
  @Redirect()
  @ApiExcludeEndpoint() // Google-invoked redirect target, not called directly by API clients
  async googleCallback(
    @Req() req: FastifyRequest & { user: GoogleProfile },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.authService.googleCallback(req.user, res);
    return {
      url:
        this.configService.get<string>('FRONTEND_URL') ??
        'http://localhost:5173',
      statusCode: 302,
    };
  }
}
