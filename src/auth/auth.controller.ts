import { Controller, Get, Redirect, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Guard redirects to Google — nothing to return
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @Redirect()
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
