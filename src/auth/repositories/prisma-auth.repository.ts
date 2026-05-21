import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuthRepository, RefreshTokenRecord } from './auth.repository';
import { AuthUser } from '../types/auth-user.type';
import { encrypt, decrypt } from '../../common/crypto.util';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  private readonly encKey: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.encKey = this.config.get<string>('APP_ENCRYPTION_KEY');
  }

  private encryptField(
    val: string | null | undefined,
  ): string | null | undefined {
    if (val == null || !this.encKey) return val;
    return encrypt(val, this.encKey);
  }

  private decryptField(
    val: string | null | undefined,
  ): string | null | undefined {
    if (val == null || !this.encKey) return val;
    try {
      return decrypt(val, this.encKey);
    } catch {
      return val;
    }
  }

  private decryptAuthUser(user: AuthUser): AuthUser {
    return {
      ...user,
      twoFactorSecret: this.decryptField(user.twoFactorSecret) ?? null,
    };
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.decryptAuthUser(user) : null;
  }

  async findUserById(id: number): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.decryptAuthUser(user) : null;
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
      data: { twoFactorSecret: this.encryptField(secret) ?? secret },
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
    data: { name?: string; email?: string; logoUrl?: string },
  ): Promise<AuthUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async createPasswordResetToken(
    userId: number,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    });
  }

  async findPasswordResetToken(
    token: string,
  ): Promise<{ userId: number; expiresAt: Date } | null> {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });
    if (!row) return null;
    return { userId: row.userId, expiresAt: row.expiresAt };
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { token } });
  }

  async deleteUserPasswordResetTokens(userId: number): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async createBackupCodes(userId: number, hashes: string[]): Promise<void> {
    await this.prisma.twoFactorBackupCode.createMany({
      data: hashes.map((codeHash) => ({ userId, codeHash })),
    });
  }

  async findMatchingBackupCode(
    userId: number,
    plainCode: string,
  ): Promise<{ id: number } | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.twoFactorBackupCode.findMany({
        where: { userId, usedAt: null },
        select: { id: true, codeHash: true },
      });
      for (const row of rows) {
        const match = await bcrypt.compare(plainCode, row.codeHash);
        if (match) {
          try {
            await tx.twoFactorBackupCode.update({
              where: { id: row.id, usedAt: null },
              data: { usedAt: new Date() },
            });
            return { id: row.id };
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === 'P2025'
            ) {
              continue;
            }
            throw err;
          }
        }
      }
      return null;
    });
  }

  async deleteBackupCodes(userId: number): Promise<void> {
    await this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } });
  }

  async getBackupCodeCount(userId: number): Promise<number> {
    return this.prisma.twoFactorBackupCode.count({
      where: { userId, usedAt: null },
    });
  }

  async isTwoFactorSecretEncrypted(userId: number): Promise<boolean> {
    if (!this.encKey) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });
    if (!user?.twoFactorSecret) return false;
    try {
      decrypt(user.twoFactorSecret, this.encKey);
      return true;
    } catch {
      return false;
    }
  }
}
