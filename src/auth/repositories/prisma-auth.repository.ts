import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AuthRepository, RefreshTokenRecord } from './auth.repository';
import { AuthUser } from '../types/auth-user.type';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: number): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<AuthUser> {
    return this.prisma.user.create({ data });
  }

  async storeRefreshToken(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async deleteRefreshToken(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  async deleteUserRefreshTokens(userId: number): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async findOAuthUser(
    provider: string,
    providerId: string,
  ): Promise<AuthUser | null> {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { user: true },
    });
    return account?.user ?? null;
  }

  async upsertOAuthUser(
    provider: string,
    providerId: string,
    email: string,
    name?: string,
  ): Promise<AuthUser> {
    const existing = await this.findOAuthUser(provider, providerId);
    if (existing) return existing;

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name },
    });

    await this.prisma.oAuthAccount.create({
      data: { provider, providerId, userId: user.id },
    });

    return user;
  }

  async setTwoFactorSecret(userId: number, secret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });
  }

  async enableTwoFactor(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  async disableTwoFactor(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }

  async updateUser(
    userId: number,
    data: { name?: string; email?: string },
  ): Promise<AuthUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
