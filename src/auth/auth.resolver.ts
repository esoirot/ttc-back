import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { VerifyTwoFactorInput } from './dto/verify-2fa.input';
import { UpdateMeInput } from './dto/update-me.input';
import { LoginResponse } from './types/login-response.type';
import { SetupTwoFactorResponse } from './types/setup-2fa-response.type';
import { GqlAuthGuard } from './guards/gql-auth.guard';
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

  @UseGuards(GqlAuthGuard)
  @Mutation(() => User)
  updateMe(
    @CurrentUser() user: { id: number },
    @Args('input') input: UpdateMeInput,
  ) {
    return this.authService.updateMe(user.id, input);
  }

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

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SetupTwoFactorResponse)
  setupTwoFactor(@CurrentUser() user: { id: number }) {
    return this.authService.setupTwoFactor(user.id);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  enableTwoFactor(
    @CurrentUser() user: { id: number },
    @Args('code') code: string,
  ) {
    return this.authService.enableTwoFactor(user.id, code);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  disableTwoFactor(
    @CurrentUser() user: { id: number },
    @Args('code') code: string,
  ) {
    return this.authService.disableTwoFactor(user.id, code);
  }

  @Mutation(() => LoginResponse)
  verifyTwoFactor(
    @Args('input') input: VerifyTwoFactorInput,
    @Context() { res }: GqlContext,
  ) {
    return this.authService.verifyTwoFactor(input.tempToken, input.code, res);
  }
}
