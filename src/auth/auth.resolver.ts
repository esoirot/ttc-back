import { Resolver, Query, Mutation, Args, Context, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { VerifyTwoFactorInput } from './dto/verify-2fa.input';
import { UpdateMeInput } from './dto/update-me.input';
import { LoginResponse } from './types/login-response.type';
import { SetupTwoFactorResponse } from './types/setup-2fa-response.type';
import { EnableTwoFactorResponse } from './types/enable-2fa-response.type';
import { VerifyTwoFactorBackupInput } from './dto/verify-2fa-backup.input';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

type GqlContext = {
  req: FastifyRequest & { cookies: Record<string, string> };
  res: FastifyReply;
};

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => User)
  me(@CurrentUser() user: { id: number }) {
    return this.authService.getUser(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(GqlAuthGuard)
  @Mutation(() => User)
  updateMe(
    @CurrentUser() user: { id: number },
    @Args('input') input: UpdateMeInput,
  ) {
    return this.authService.updateMe(user.id, input);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Mutation(() => User)
  async register(
    @Args('input') input: RegisterInput,
    @Context() { res }: GqlContext,
  ) {
    const user = await this.authService.register(
      input.email,
      input.password,
      input.name,
    );
    return (await this.authService.login(user, res)).user;
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Mutation(() => LoginResponse)
  async login(
    @Args('input') input: LoginInput,
    @Context() { res }: GqlContext,
  ): Promise<LoginResponse> {
    const user = await this.authService.validateUser(
      input.email,
      input.password,
    );
    if (!user) {
      const { UnauthorizedException } = await import('@nestjs/common');
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user, res);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  logout(@CurrentUser() user: { id: number }, @Context() { res }: GqlContext) {
    return this.authService.logout(user.id, res);
  }

  @Mutation(() => Boolean)
  refreshToken(@Context() { req, res }: GqlContext) {
    return this.authService.refresh(req.cookies['refresh_token'], res);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(GqlAuthGuard)
  @Mutation(() => SetupTwoFactorResponse)
  setupTwoFactor(@CurrentUser() user: { id: number }) {
    return this.authService.setupTwoFactor(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(GqlAuthGuard)
  @Mutation(() => EnableTwoFactorResponse)
  enableTwoFactor(
    @CurrentUser() user: { id: number },
    @Args('code') code: string,
  ) {
    return this.authService
      .enableTwoFactor(user.id, code)
      .then((backupCodes) => ({ backupCodes }));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  disableTwoFactor(
    @CurrentUser() user: { id: number },
    @Args('code') code: string,
  ) {
    return this.authService.disableTwoFactor(user.id, code);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Mutation(() => LoginResponse)
  verifyTwoFactor(
    @Args('input') input: VerifyTwoFactorInput,
    @Context() { res }: GqlContext,
  ) {
    return this.authService.verifyTwoFactor(input.tempToken, input.code, res);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Mutation(() => LoginResponse)
  verifyTwoFactorBackup(
    @Args('input') input: VerifyTwoFactorBackupInput,
    @Context() { res }: GqlContext,
  ) {
    return this.authService.verifyTwoFactorBackup(
      input.tempToken,
      input.backupCode,
      res,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(GqlAuthGuard)
  @Mutation(() => EnableTwoFactorResponse)
  regenerateBackupCodes(
    @CurrentUser() user: { id: number },
    @Args('code') code: string,
  ) {
    return this.authService
      .regenerateBackupCodes(user.id, code)
      .then((backupCodes) => ({ backupCodes }));
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Boolean)
  adminDisableTwoFactor(
    @CurrentUser() admin: { id: number },
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<boolean> {
    return this.authService.adminDisableTwoFactor(admin.id, userId);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Int)
  backupCodeCount(@CurrentUser() user: { id: number }): Promise<number> {
    return this.authService.getBackupCodeCount(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Mutation(() => Boolean)
  requestPasswordReset(@Args('email') email: string): Promise<boolean> {
    return this.authService.requestPasswordReset(email);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Mutation(() => Boolean)
  resetPassword(
    @Args('token') token: string,
    @Args('newPassword') newPassword: string,
  ): Promise<boolean> {
    return this.authService.resetPassword(token, newPassword);
  }
}
