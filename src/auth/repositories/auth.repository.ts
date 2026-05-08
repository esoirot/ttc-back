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
    data: { name?: string; email?: string },
  ): Promise<AuthUser>;
}
