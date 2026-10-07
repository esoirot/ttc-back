import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { decrypt, encrypt } from '../../common/crypto.util';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import { AuthUser } from '../types/auth-user.type';
import { AuthRepository, RefreshTokenRecord } from './auth.repository';

type UserRow = NonNullable<
  Awaited<ReturnType<Prisma8Service['orm']['public']['User']['first']>>
>;
type ProfileUpdate = Parameters<AuthRepository['updateUser']>[1];

@Injectable()
export class Prisma8AuthRepository implements AuthRepository {
  private readonly encKey: string;

  constructor(
    private readonly db: Prisma8Service,
    private readonly config: ConfigService,
  ) {
    this.encKey = this.config.getOrThrow<string>('APP_ENCRYPTION_KEY');
  }

  private get orm() {
    return this.db.orm.public;
  }

  private decryptField(val: string | null): string | null {
    if (val == null) return val;
    try {
      return decrypt(val, this.encKey);
    } catch {
      return val;
    }
  }

  /** The user row as AuthUser: dates as Date, 2FA secret decrypted. */
  private toAuthUser(user: UserRow): AuthUser {
    return {
      ...user,
      adminPermissions: [...(user.adminPermissions ?? [])],
      createdAt: fromDb(user.createdAt),
      updatedAt: fromDb(user.updatedAt),
      hubspotTokenExpiresAt: fromDb(user.hubspotTokenExpiresAt),
      googleCalendarTokenExpiresAt: fromDb(user.googleCalendarTokenExpiresAt),
      twoFactorSecret: this.decryptField(user.twoFactorSecret),
    } as AuthUser;
  }

  private async updateUserRow(
    id: number,
    data: Parameters<
      ReturnType<Prisma8Service['orm']['public']['User']['where']>['update']
    >[0],
  ) {
    return this.orm.User.where({ id }).update({ ...data, updatedAt: nowDb() });
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.orm.User.first({ email });
    return user ? this.toAuthUser(user) : null;
  }

  async findUserById(id: number): Promise<AuthUser | null> {
    const user = await this.orm.User.first({ id });
    return user ? this.toAuthUser(user) : null;
  }

  async createUser(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<AuthUser> {
    return this.toAuthUser(
      await this.orm.User.create({ ...data, updatedAt: nowDb() }),
    );
  }

  async storeRefreshToken(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.orm.RefreshToken.create({
      userId,
      tokenHash,
      expiresAt: toDb(expiresAt),
    });
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    const row = await this.orm.RefreshToken.first({ tokenHash });
    return row
      ? ({
          ...row,
          expiresAt: fromDb(row.expiresAt),
          createdAt: fromDb(row.createdAt),
        } as RefreshTokenRecord)
      : null;
  }

  async deleteRefreshToken(tokenHash: string): Promise<void> {
    await this.orm.RefreshToken.where({ tokenHash }).deleteAndCount();
  }

  async deleteUserRefreshTokens(userId: number): Promise<void> {
    await this.orm.RefreshToken.where({ userId }).deleteAndCount();
  }

  async findOAuthUser(
    provider: string,
    providerId: string,
  ): Promise<AuthUser | null> {
    const account = await this.orm.OAuthAccount.include('user').first({
      provider,
      providerId,
    });
    return account?.user ? this.toAuthUser(account.user) : null;
  }

  async upsertOAuthUser(
    provider: string,
    providerId: string,
    email: string,
    name?: string,
  ): Promise<AuthUser> {
    const existing = await this.findOAuthUser(provider, providerId);
    if (existing) return existing;
    const user =
      (await this.orm.User.first({ email })) ??
      (await this.orm.User.create({ email, name, updatedAt: nowDb() }));
    await this.orm.OAuthAccount.create({
      provider,
      providerId,
      userId: user.id,
    });
    return this.toAuthUser(user);
  }

  async setTwoFactorSecret(userId: number, secret: string): Promise<void> {
    await this.updateUserRow(userId, {
      twoFactorSecret: encrypt(secret, this.encKey),
    });
  }

  async enableTwoFactor(userId: number): Promise<void> {
    await this.updateUserRow(userId, { twoFactorEnabled: true });
  }

  async disableTwoFactor(userId: number): Promise<void> {
    await this.updateUserRow(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });
  }

  async updateUser(userId: number, data: ProfileUpdate): Promise<AuthUser> {
    return this.toAuthUser((await this.updateUserRow(userId, data))!);
  }

  async createPasswordResetToken(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.orm.PasswordResetToken.create({
      userId,
      tokenHash,
      expiresAt: toDb(expiresAt),
    });
  }

  async findPasswordResetToken(
    tokenHash: string,
  ): Promise<{ userId: number; expiresAt: Date } | null> {
    const row = await this.orm.PasswordResetToken.first({ tokenHash });
    return row
      ? { userId: row.userId, expiresAt: fromDb(row.expiresAt) }
      : null;
  }

  async deletePasswordResetToken(tokenHash: string): Promise<void> {
    await this.orm.PasswordResetToken.where({ tokenHash }).deleteAndCount();
  }

  async deleteUserPasswordResetTokens(userId: number): Promise<void> {
    await this.orm.PasswordResetToken.where({ userId }).deleteAndCount();
  }

  async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.updateUserRow(userId, { password: hashedPassword });
  }

  async createBackupCodes(userId: number, hashes: string[]): Promise<void> {
    await this.orm.TwoFactorBackupCode.createAll(
      hashes.map((codeHash) => ({ userId, codeHash })),
    );
  }

  async findMatchingBackupCode(
    userId: number,
    plainCode: string,
  ): Promise<{ id: number } | null> {
    return this.db.transaction(async (tx) => {
      const unused = await tx.orm.public.TwoFactorBackupCode.where({ userId })
        .where((c) => c.usedAt.isNull())
        .select('id', 'codeHash')
        .all();
      for (const row of unused) {
        if (!(await bcrypt.compare(plainCode, row.codeHash))) continue;
        // Consumed only if still unused: a concurrent use of the same code loses.
        const used = await tx.orm.public.TwoFactorBackupCode.where({
          id: row.id,
        })
          .where((c) => c.usedAt.isNull())
          .updateAndCount({ usedAt: nowDb() });
        if (used === 1) return { id: row.id };
      }
      return null;
    });
  }

  async deleteBackupCodes(userId: number): Promise<void> {
    await this.orm.TwoFactorBackupCode.where({ userId }).deleteAndCount();
  }

  async getBackupCodeCount(userId: number): Promise<number> {
    const unused = await this.orm.TwoFactorBackupCode.where({ userId })
      .where((c) => c.usedAt.isNull())
      .select('id')
      .all();
    return unused.length;
  }

  async deleteUser(userId: number): Promise<void> {
    await this.orm.User.where({ id: userId }).delete();
  }

  async isTwoFactorSecretEncrypted(userId: number): Promise<boolean> {
    const user = await this.orm.User.select('twoFactorSecret').first({
      id: userId,
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
