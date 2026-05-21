import { AuthUser } from '../types/auth-user.type';

export type RefreshTokenRecord = {
  id: number;
  tokenHash: string;
  userId: number;
  expiresAt: Date;
};

export abstract class AuthRepository {
  abstract findUserByEmail(email: string): Promise<AuthUser | null>;
  abstract findUserById(id: number): Promise<AuthUser | null>;
  abstract createUser(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<AuthUser>;
  abstract storeRefreshToken(
    userId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  abstract findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null>;
  abstract deleteRefreshToken(tokenHash: string): Promise<void>;
  abstract deleteUserRefreshTokens(userId: number): Promise<void>;
  abstract findOAuthUser(
    provider: string,
    providerId: string,
  ): Promise<AuthUser | null>;
  abstract upsertOAuthUser(
    provider: string,
    providerId: string,
    email: string,
    name?: string,
  ): Promise<AuthUser>;
  abstract setTwoFactorSecret(userId: number, secret: string): Promise<void>;
  abstract enableTwoFactor(userId: number): Promise<void>;
  abstract disableTwoFactor(userId: number): Promise<void>;
  abstract updateUser(
    userId: number,
    data: { name?: string; email?: string; logoUrl?: string },
  ): Promise<AuthUser>;
  abstract createPasswordResetToken(
    userId: number,
    token: string,
    expiresAt: Date,
  ): Promise<void>;
  abstract findPasswordResetToken(
    token: string,
  ): Promise<{ userId: number; expiresAt: Date } | null>;
  abstract deletePasswordResetToken(token: string): Promise<void>;
  abstract deleteUserPasswordResetTokens(userId: number): Promise<void>;
  abstract updatePassword(
    userId: number,
    hashedPassword: string,
  ): Promise<void>;
  abstract createBackupCodes(userId: number, hashes: string[]): Promise<void>;
  abstract findMatchingBackupCode(
    userId: number,
    plainCode: string,
  ): Promise<{ id: number } | null>;
  abstract deleteBackupCodes(userId: number): Promise<void>;
  abstract getBackupCodeCount(userId: number): Promise<number>;
  abstract isTwoFactorSecretEncrypted(userId: number): Promise<boolean>;
}
