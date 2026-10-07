import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthEventsService } from './auth-events.service';
import { AuthResolver } from './auth.resolver';
import { AuthController } from './auth.controller';
import { AuthEventsController } from './auth-events.controller';
import { AuthRepository } from './repositories/auth.repository';
import { Prisma8AuthRepository } from './repositories/prisma8-auth.repository';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import {
  GoogleInitiateGuard,
  GoogleCallbackGuard,
} from './guards/google-auth.guard';
import { EmailService } from './email.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN') ?? '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController, AuthEventsController],
  providers: [
    AuthService,
    AuthEventsService,
    AuthResolver,
    { provide: AuthRepository, useClass: Prisma8AuthRepository },
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    GqlAuthGuard,
    RolesGuard,
    GoogleInitiateGuard,
    GoogleCallbackGuard,
    EmailService,
  ],
  exports: [AuthService, AuthEventsService, GqlAuthGuard, RolesGuard],
})
export class AuthModule {}
