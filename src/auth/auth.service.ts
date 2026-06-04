import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import type { FastifyReply } from 'fastify';
import type { JwtSignOptions } from '@nestjs/jwt';
import { AuthRepository } from './repositories/auth.repository';
import { AuditService } from '../audit/audit.service';
import { EmailService } from './email.service';
import { AuthEventsService } from './auth-events.service';
import { isAllowedLogoUrl } from '../common/logo-url.util';
import { AuthUser } from './types/auth-user.type';
import { JwtPayload } from './types/jwt-payload.type';
import { GoogleProfile } from './strategies/google.strategy';
import { LoginResponse } from './types/login-response.type';
import { User, Role } from '../users/entities/user.entity';

const COOKIE_OPTS_BASE = {
  httpOnly: true,
  sameSite: 'strict' as const,
  path: '/',
};

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly authEventsService: AuthEventsService,
  ) {}

  async getUser(id: number): Promise<AuthUser | null> {
    return this.repo.findUserById(id);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.repo.findUserByEmail(email);
    if (!user?.password) return null;
    const match = await bcrypt.compare(password, user.password);
    return match ? user : null;
  }

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<AuthUser> {
    const existing = await this.repo.findUserByEmail(email);
    if (existing) throw new ConflictException('Email already in use');
    const hash = await bcrypt.hash(password, 12);
    return this.repo.createUser({ email, password: hash, name });
  }

  async login(user: AuthUser, res: FastifyReply): Promise<LoginResponse> {
    if (user.twoFactorEnabled) {
      const tempToken = this.signToken(user, 'temp', '5m');
      return { requiresTwoFactor: true, tempToken };
    }
    await this.issueTokens(user, res);
    return { user: this.toUserEntity(user) };
  }

  async refresh(
    rawRefreshToken: string | undefined,
    res: FastifyReply,
  ): Promise<boolean> {
    if (!rawRefreshToken) throw new UnauthorizedException();

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(rawRefreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }

    const record = await this.repo.findRefreshTokenByHash(
      sha256(rawRefreshToken),
    );
    if (!record || record.expiresAt < new Date())
      throw new UnauthorizedException();

    const user = await this.repo.findUserById(payload.sub);
    if (!user) throw new UnauthorizedException();

    await this.repo.deleteRefreshToken(sha256(rawRefreshToken));
    await this.issueTokens(user, res);
    return true;
  }

  async logout(userId: number, res: FastifyReply): Promise<boolean> {
    await this.repo.deleteUserRefreshTokens(userId);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    void this.authEventsService.publish(userId, { type: 'session_revoked' });
    return true;
  }

  async googleCallback(
    profile: GoogleProfile,
    res: FastifyReply,
  ): Promise<void> {
    const user = await this.repo.upsertOAuthUser(
      'google',
      profile.providerId,
      profile.email,
      profile.name,
    );
    await this.issueTokens(user, res);
  }

  async updateMe(
    userId: number,
    data: {
      name?: string;
      email?: string;
      logoUrl?: string;
      defaultCurrency?: string;
      firstName?: string | null;
      lastName?: string | null;
      mobilePhone?: string | null;
      jobTitle?: string | null;
      interfaceLanguage?: string | null;
      dateFormat?: string | null;
      hourFormat?: string | null;
      numberFormat?: string | null;
    },
  ): Promise<AuthUser> {
    if (data.logoUrl && !isAllowedLogoUrl(data.logoUrl)) {
      throw new BadRequestException('Invalid or disallowed logo URL');
    }
    return this.repo.updateUser(userId, data);
  }

  async setupTwoFactor(userId: number) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new UnauthorizedException();

    const secretObj = speakeasy.generateSecret({
      name: `TranslatorAssistant (${user.email})`,
    });
    await this.repo.setTwoFactorSecret(userId, secretObj.base32);

    const qrCodeUrl = await qrcode.toDataURL(secretObj.otpauth_url!);
    return { qrCodeUrl, secret: secretObj.base32 };
  }

  async enableTwoFactor(userId: number, code: string): Promise<string[]> {
    const user = await this.repo.findUserById(userId);
    if (!user?.twoFactorSecret) throw new UnauthorizedException();

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');

    const plainCodes = Array.from({ length: 8 }, () =>
      randomBytes(10).toString('hex'),
    );
    const hashes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));
    await this.repo.deleteBackupCodes(userId);
    await this.repo.createBackupCodes(userId, hashes);
    await this.repo.enableTwoFactor(userId);
    return plainCodes;
  }

  async disableTwoFactor(userId: number, code: string): Promise<boolean> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.twoFactorEnabled)
      throw new BadRequestException('2FA is not enabled');
    if (!user.twoFactorSecret) throw new UnauthorizedException();

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');

    await this.repo.deleteBackupCodes(userId);
    await this.repo.disableTwoFactor(userId);
    return true;
  }

  async verifyTwoFactorBackup(
    tempToken: string,
    backupCode: string,
    res: FastifyReply,
  ): Promise<LoginResponse> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(tempToken);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'temp') throw new UnauthorizedException();

    const user = await this.repo.findUserById(payload.sub);
    if (!user) throw new UnauthorizedException();

    const match = await this.repo.findMatchingBackupCode(user.id, backupCode);
    if (!match) throw new UnauthorizedException('Invalid backup code');

    await this.issueTokens(user, res);
    return { user: this.toUserEntity(user) };
  }

  async verifyTwoFactor(
    tempToken: string,
    code: string,
    res: FastifyReply,
  ): Promise<LoginResponse> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(tempToken);
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'temp') throw new UnauthorizedException();

    const user = await this.repo.findUserById(payload.sub);
    if (!user?.twoFactorSecret) throw new UnauthorizedException();

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');

    if (!(await this.repo.isTwoFactorSecretEncrypted(user.id))) {
      await this.repo.setTwoFactorSecret(user.id, user.twoFactorSecret);
    }

    await this.issueTokens(user, res);
    return { user: this.toUserEntity(user) };
  }

  async regenerateBackupCodes(userId: number, code: string): Promise<string[]> {
    const user = await this.repo.findUserById(userId);
    if (!user?.twoFactorSecret) throw new UnauthorizedException();

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');

    const plainCodes = Array.from({ length: 8 }, () =>
      randomBytes(10).toString('hex'),
    );
    const hashes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));
    await this.repo.deleteBackupCodes(userId);
    await this.repo.createBackupCodes(userId, hashes);
    return plainCodes;
  }

  async adminDisableTwoFactor(
    adminId: number,
    targetUserId: number,
  ): Promise<boolean> {
    await this.repo.deleteBackupCodes(targetUserId);
    await this.repo.disableTwoFactor(targetUserId);
    this.auditService.log(adminId, 'ADMIN_DISABLE_2FA', 'auth', {
      targetUserId,
    });
    return true;
  }

  async getBackupCodeCount(userId: number): Promise<number> {
    return this.repo.getBackupCodeCount(userId);
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) return true;
    await this.repo.deleteUserPasswordResetTokens(user.id);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.repo.createPasswordResetToken(user.id, token, expiresAt);
    await this.emailService.sendPasswordReset(email, token);
    return true;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.repo.findUserById(userId);
    if (!user?.password) {
      throw new BadRequestException(
        'Account uses OAuth — no password to change',
      );
    }
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      throw new BadRequestException('Incorrect current password');
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.repo.updatePassword(userId, hashed);
    return true;
  }

  async deleteAccount(userId: number, res: FastifyReply): Promise<boolean> {
    await this.repo.deleteUserRefreshTokens(userId);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    await this.repo.deleteUser(userId);
    return true;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const record = await this.repo.findPasswordResetToken(token);
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.repo.updatePassword(record.userId, hashed);
    await this.repo.deletePasswordResetToken(token);
    return true;
  }

  private toUserEntity(authUser: AuthUser): User {
    return Object.assign(new User(), {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name ?? undefined,
      role: authUser.role as Role,
      twoFactorEnabled: authUser.twoFactorEnabled,
    });
  }

  private signToken(
    user: AuthUser,
    type: 'access' | 'temp',
    expiresIn?: string,
  ): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type,
    };
    return expiresIn
      ? this.jwtService.sign(payload, {
          expiresIn: expiresIn as unknown as NonNullable<
            JwtSignOptions['expiresIn']
          >,
        })
      : this.jwtService.sign(payload);
  }

  private async issueTokens(user: AuthUser, res: FastifyReply) {
    const isProd = this.configService.get('NODE_ENV') === 'production';
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiry =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessToken = this.signToken(user, 'access');
    const rawRefreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
        jti: randomBytes(16).toString('hex'),
      } satisfies JwtPayload,
      {
        secret: refreshSecret,
        expiresIn: refreshExpiry as unknown as NonNullable<
          JwtSignOptions['expiresIn']
        >,
      },
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.repo.storeRefreshToken(
      user.id,
      sha256(rawRefreshToken),
      expiresAt,
    );

    res.setCookie('access_token', accessToken, {
      ...COOKIE_OPTS_BASE,
      secure: isProd,
      maxAge: 15 * 60,
    });
    res.setCookie('refresh_token', rawRefreshToken, {
      ...COOKIE_OPTS_BASE,
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60,
    });
  }
}
