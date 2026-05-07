import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { AuthController } from './auth.controller';
import { AuthRepository } from './repositories/auth.repository';
import { PrismaAuthRepository } from './repositories/prisma-auth.repository';
import { PrismaService } from '../prisma.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
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
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthResolver,
    PrismaService,
    PrismaAuthRepository,
    { provide: AuthRepository, useClass: PrismaAuthRepository },
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    GqlAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, GqlAuthGuard, RolesGuard],
})
export class AuthModule {}
