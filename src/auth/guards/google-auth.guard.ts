import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import {
  signOAuthState,
  verifyOAuthState,
} from '../../common/oauth-state.util';

const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

// No session support in this Fastify app (stateless JWT-cookie design), so
// Passport's default session-based `state:true` CSRF protection isn't usable.
// Hand-rolled HMAC-signed state instead — same approach as HubSpot's OAuth flow.

@Injectable()
export class GoogleInitiateGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  getAuthenticateOptions(): { state: string } {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return { state: signOAuthState(secret, {}, GOOGLE_OAUTH_STATE_TTL_MS) };
  }
}

@Injectable()
export class GoogleCallbackGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const state = (request.query as Record<string, string> | undefined)?.state;
    if (!state) throw new UnauthorizedException('Missing OAuth state');

    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    verifyOAuthState(secret, state);

    return super.canActivate(context) as Promise<boolean>;
  }
}
