import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: FastifyRequest) =>
          (req?.cookies as Record<string, string | undefined>)[
            'access_token'
          ] ?? null,
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtPayload): { id: number; email: string; role: string } {
    if (payload.type !== 'access') throw new UnauthorizedException();
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
