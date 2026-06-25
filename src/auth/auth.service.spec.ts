import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { AuthRepository } from './repositories/auth.repository';
import { AuditService } from '../audit/audit.service';
import { EmailService } from './email.service';
import { AuthEventsService } from './auth-events.service';
import { mockUser, mockFastifyReply } from '../__test-helpers__/mock-factories';

const makeReply = () => mockFastifyReply() as unknown as FastifyReply;

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: { verify: jest.fn() },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';

type MockedOf<T> = { [K in keyof T]: jest.Mock };

describe('AuthService', () => {
  let service: AuthService;
  let repo: MockedOf<AuthRepository>;
  let jwtService: MockedOf<JwtService>;
  let configService: MockedOf<ConfigService>;
  let emailService: MockedOf<EmailService>;
  let auditService: { log: jest.Mock };
  let authEventsService: { publish: jest.Mock };

  beforeEach(async () => {
    repo = {
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      createUser: jest.fn(),
      storeRefreshToken: jest.fn(),
      findRefreshTokenByHash: jest.fn(),
      deleteRefreshToken: jest.fn(),
      deleteUserRefreshTokens: jest.fn(),
      findOAuthUser: jest.fn(),
      upsertOAuthUser: jest.fn(),
      setTwoFactorSecret: jest.fn(),
      enableTwoFactor: jest.fn(),
      disableTwoFactor: jest.fn(),
      updateUser: jest.fn(),
      createPasswordResetToken: jest.fn(),
      findPasswordResetToken: jest.fn(),
      deletePasswordResetToken: jest.fn(),
      deleteUserPasswordResetTokens: jest.fn(),
      updatePassword: jest.fn(),
      createBackupCodes: jest.fn(),
      findMatchingBackupCode: jest.fn(),
      deleteBackupCodes: jest.fn(),
      getBackupCodeCount: jest.fn(),
      isTwoFactorSecretEncrypted: jest.fn(),
      deleteUser: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    } as unknown as MockedOf<JwtService>;

    configService = {
      get: jest.fn().mockReturnValue(undefined),
      getOrThrow: jest.fn().mockReturnValue('mock-secret'),
    } as unknown as MockedOf<ConfigService>;

    emailService = {
      sendPasswordReset: jest.fn(),
    };
    auditService = { log: jest.fn() };
    authEventsService = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
        { provide: AuditService, useValue: auditService },
        { provide: AuthEventsService, useValue: authEventsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
    jwtService.sign.mockReturnValue('mock-token');
    configService.getOrThrow.mockReturnValue('mock-secret');
    configService.get.mockReturnValue(undefined);
    repo.storeRefreshToken.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('returns user when credentials match', async () => {
      const user = mockUser();
      repo.findUserByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('user@example.com', 'password');
      expect(result).toEqual(user);
    });

    it('returns null when password does not match', async () => {
      repo.findUserByEmail.mockResolvedValue(mockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('user@example.com', 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when user not found', async () => {
      repo.findUserByEmail.mockResolvedValue(null);

      const result = await service.validateUser('unknown@example.com', 'pass');
      expect(result).toBeNull();
    });

    it('returns null when user has no password (OAuth account)', async () => {
      repo.findUserByEmail.mockResolvedValue(mockUser({ password: null }));

      const result = await service.validateUser('user@example.com', 'pass');
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('throws ConflictException when email already in use', async () => {
      repo.findUserByEmail.mockResolvedValue(mockUser());

      await expect(
        service.register('user@example.com', 'password'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user with hashed password', async () => {
      const user = mockUser();
      repo.findUserByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      repo.createUser.mockResolvedValue(user);

      const result = await service.register(
        'user@example.com',
        'password',
        'Alice',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('password', 12);
      expect(repo.createUser).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'hashed-password',
        name: 'Alice',
      });
      expect(result).toEqual(user);
    });
  });

  describe('login', () => {
    it('returns requiresTwoFactor when 2FA is enabled', async () => {
      const user = mockUser({ twoFactorEnabled: true });
      const result = await service.login(user, makeReply());

      expect(result).toEqual({
        requiresTwoFactor: true,
        tempToken: 'mock-token',
      });
    });

    it('issues tokens and returns user when 2FA disabled', async () => {
      const user = mockUser({ twoFactorEnabled: false });
      const res = mockFastifyReply();

      const result = await service.login(user, res as unknown as FastifyReply);

      expect(repo.storeRefreshToken).toHaveBeenCalled();
      expect(res.setCookie).toHaveBeenCalledWith(
        'access_token',
        'mock-token',
        expect.any(Object),
      );
      expect(res.setCookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-token',
        expect.any(Object),
      );
      expect(result).toMatchObject({
        user: { id: user.id },
      });
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when no token provided', async () => {
      await expect(service.refresh(undefined, makeReply())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when JWT is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.refresh('bad-token', makeReply())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when DB record not found', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'access',
      });
      repo.findRefreshTokenByHash.mockResolvedValue(null);

      await expect(service.refresh('valid-token', makeReply())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when DB record is expired', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'access',
      });
      repo.findRefreshTokenByHash.mockResolvedValue({
        id: 1,
        tokenHash: 'hash',
        userId: 1,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('valid-token', makeReply())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rotates token on success', async () => {
      const user = mockUser();
      const res = mockFastifyReply();
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'access',
      });
      repo.findRefreshTokenByHash.mockResolvedValue({
        id: 1,
        tokenHash: 'hash',
        userId: 1,
        expiresAt: new Date(Date.now() + 60000),
      });
      repo.findUserById.mockResolvedValue(user);

      const result = await service.refresh(
        'valid-token',
        res as unknown as FastifyReply,
      );

      expect(repo.deleteRefreshToken).toHaveBeenCalled();
      expect(repo.storeRefreshToken).toHaveBeenCalled();
      expect(res.setCookie).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });
  });

  describe('logout', () => {
    it('deletes tokens, clears cookies, publishes session_revoked', async () => {
      const res = mockFastifyReply();
      repo.deleteUserRefreshTokens.mockResolvedValue(undefined);

      const result = await service.logout(1, res as unknown as FastifyReply);

      expect(repo.deleteUserRefreshTokens).toHaveBeenCalledWith(1);
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
      expect(authEventsService.publish).toHaveBeenCalledWith(1, {
        type: 'session_revoked',
      });
      expect(result).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('throws BadRequestException when new password too short', async () => {
      await expect(
        service.changePassword(1, 'current', 'short'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when user has no password (OAuth)', async () => {
      repo.findUserById.mockResolvedValue(mockUser({ password: null }));

      await expect(
        service.changePassword(1, 'current', 'longenough'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when current password is wrong', async () => {
      repo.findUserById.mockResolvedValue(mockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(1, 'wrong', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password on success', async () => {
      repo.findUserById.mockResolvedValue(mockUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      repo.updatePassword.mockResolvedValue(undefined);

      const result = await service.changePassword(1, 'current', 'newpassword');

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 12);
      expect(repo.updatePassword).toHaveBeenCalledWith(1, 'new-hash');
      expect(result).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException when password too short', async () => {
      await expect(service.resetPassword('token', 'short')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when token not found', async () => {
      repo.findPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is expired', async () => {
      repo.findPasswordResetToken.mockResolvedValue({
        userId: 1,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword('expired-token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('resets password and deletes token on success', async () => {
      repo.findPasswordResetToken.mockResolvedValue({
        userId: 1,
        expiresAt: new Date(Date.now() + 60000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      repo.updatePassword.mockResolvedValue(undefined);
      repo.deletePasswordResetToken.mockResolvedValue(undefined);

      const result = await service.resetPassword('valid-token', 'newpassword');

      expect(repo.updatePassword).toHaveBeenCalledWith(1, 'new-hash');
      expect(repo.deletePasswordResetToken).toHaveBeenCalledWith('valid-token');
      expect(result).toBe(true);
    });
  });

  describe('requestPasswordReset', () => {
    it('returns true silently when email not found', async () => {
      repo.findUserByEmail.mockResolvedValue(null);

      const result = await service.requestPasswordReset('nobody@example.com');
      expect(result).toBe(true);
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('creates reset token and sends email', async () => {
      const user = mockUser();
      repo.findUserByEmail.mockResolvedValue(user);
      repo.deleteUserPasswordResetTokens.mockResolvedValue(undefined);
      repo.createPasswordResetToken.mockResolvedValue(undefined);
      emailService.sendPasswordReset.mockResolvedValue(undefined);

      const result = await service.requestPasswordReset('user@example.com');

      expect(repo.deleteUserPasswordResetTokens).toHaveBeenCalledWith(user.id);
      expect(repo.createPasswordResetToken).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
      );
      expect(result).toBe(true);
    });
  });

  describe('verifyTwoFactor', () => {
    it('throws UnauthorizedException when token type is not temp', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'access',
      });

      await expect(
        service.verifyTwoFactor('token', '123456', makeReply()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'temp',
      });
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorSecret: 'BASE32SECRET' }),
      );
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(
        service.verifyTwoFactor('token', 'wrong', makeReply()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues tokens on success', async () => {
      const user = mockUser({ twoFactorSecret: 'BASE32SECRET' });
      const res = mockFastifyReply();
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'temp',
      });
      repo.findUserById.mockResolvedValue(user);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      repo.isTwoFactorSecretEncrypted.mockResolvedValue(true);

      const result = await service.verifyTwoFactor(
        'token',
        '123456',
        res as unknown as FastifyReply,
      );

      expect(repo.storeRefreshToken).toHaveBeenCalled();
      expect(res.setCookie).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        user: { id: user.id },
      });
    });
  });

  describe('enableTwoFactor', () => {
    it('throws UnauthorizedException when user has no secret', async () => {
      repo.findUserById.mockResolvedValue(mockUser({ twoFactorSecret: null }));

      await expect(service.enableTwoFactor(1, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorSecret: 'SECRET' }),
      );
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(service.enableTwoFactor(1, 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('stores hashed backup codes and enables 2FA on success', async () => {
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorSecret: 'SECRET' }),
      );
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-code');
      repo.deleteBackupCodes.mockResolvedValue(undefined);
      repo.createBackupCodes.mockResolvedValue(undefined);
      repo.enableTwoFactor.mockResolvedValue(undefined);

      const codes = await service.enableTwoFactor(1, '123456');

      expect(repo.deleteBackupCodes).toHaveBeenCalledWith(1);
      expect(repo.createBackupCodes).toHaveBeenCalledWith(1, expect.any(Array));
      expect(repo.enableTwoFactor).toHaveBeenCalledWith(1);
      expect(codes).toHaveLength(8);
      codes.forEach((c) => expect(typeof c).toBe('string'));
    });
  });

  describe('adminDisableTwoFactor', () => {
    it('disables 2FA for target user and logs audit', async () => {
      repo.deleteBackupCodes.mockResolvedValue(undefined);
      repo.disableTwoFactor.mockResolvedValue(undefined);

      const result = await service.adminDisableTwoFactor(99, 5);

      expect(repo.deleteBackupCodes).toHaveBeenCalledWith(5);
      expect(repo.disableTwoFactor).toHaveBeenCalledWith(5);
      expect(auditService.log).toHaveBeenCalledWith(
        99,
        'ADMIN_DISABLE_2FA',
        'auth',
        { targetUserId: 5 },
      );
      expect(result).toBe(true);
    });
  });

  describe('getUser', () => {
    it('delegates to repo.findUserById', async () => {
      const user = mockUser();
      repo.findUserById.mockResolvedValue(user);

      const result = await service.getUser(1);
      expect(repo.findUserById).toHaveBeenCalledWith(1);
      expect(result).toEqual(user);
    });
  });

  describe('getBackupCodeCount', () => {
    it('delegates to repo.getBackupCodeCount', async () => {
      repo.getBackupCodeCount.mockResolvedValue(6);

      const result = await service.getBackupCodeCount(1);
      expect(repo.getBackupCodeCount).toHaveBeenCalledWith(1);
      expect(result).toBe(6);
    });
  });

  describe('updateMe', () => {
    it('updates user when no logoUrl', async () => {
      const user = mockUser({ name: 'New Name' });
      repo.updateUser.mockResolvedValue(user);

      const result = await service.updateMe(1, { name: 'New Name' });
      expect(repo.updateUser).toHaveBeenCalledWith(1, { name: 'New Name' });
      expect(result).toEqual(user);
    });

    it('throws BadRequestException for disallowed logoUrl', async () => {
      await expect(
        service.updateMe(1, { logoUrl: 'http://localhost/evil' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateUser).not.toHaveBeenCalled();
    });

    it('allows valid external logoUrl', async () => {
      const user = mockUser();
      repo.updateUser.mockResolvedValue(user);

      await service.updateMe(1, { logoUrl: 'https://example.com/logo.png' });
      expect(repo.updateUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ logoUrl: 'https://example.com/logo.png' }),
      );
    });
  });

  describe('googleCallback', () => {
    it('upserts OAuth user and issues tokens', async () => {
      const user = mockUser({ twoFactorEnabled: false });
      const res = mockFastifyReply();
      repo.upsertOAuthUser.mockResolvedValue(user);

      await service.googleCallback(
        {
          providerId: 'google-123',
          email: 'g@example.com',
          name: 'Google User',
        },
        res as unknown as FastifyReply,
      );

      expect(repo.upsertOAuthUser).toHaveBeenCalledWith(
        'google',
        'google-123',
        'g@example.com',
        'Google User',
      );
      expect(res.setCookie).toHaveBeenCalledWith(
        'access_token',
        'mock-token',
        expect.any(Object),
      );
      expect(res.setCookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-token',
        expect.any(Object),
      );
    });
  });

  describe('deleteAccount', () => {
    it('deletes tokens, clears cookies, deletes user', async () => {
      const res = mockFastifyReply();
      repo.deleteUserRefreshTokens.mockResolvedValue(undefined);
      repo.deleteUser.mockResolvedValue(undefined);

      const result = await service.deleteAccount(
        1,
        res as unknown as FastifyReply,
      );

      expect(repo.deleteUserRefreshTokens).toHaveBeenCalledWith(1);
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
      expect(repo.deleteUser).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('disableTwoFactor', () => {
    it('throws UnauthorizedException when user not found', async () => {
      repo.findUserById.mockResolvedValue(null);

      await expect(service.disableTwoFactor(1, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException when 2FA not enabled', async () => {
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorEnabled: false, twoFactorSecret: 'SECRET' }),
      );

      await expect(service.disableTwoFactor(1, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws UnauthorizedException when user has no secret', async () => {
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorEnabled: true, twoFactorSecret: null }),
      );

      await expect(service.disableTwoFactor(1, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when TOTP code invalid', async () => {
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET' }),
      );
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(service.disableTwoFactor(1, 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('disables 2FA and deletes backup codes on success', async () => {
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorEnabled: true, twoFactorSecret: 'SECRET' }),
      );
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      repo.deleteBackupCodes.mockResolvedValue(undefined);
      repo.disableTwoFactor.mockResolvedValue(undefined);

      const result = await service.disableTwoFactor(1, '123456');

      expect(repo.deleteBackupCodes).toHaveBeenCalledWith(1);
      expect(repo.disableTwoFactor).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('verifyTwoFactorBackup', () => {
    it('throws UnauthorizedException when JWT invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad');
      });

      await expect(
        service.verifyTwoFactorBackup('bad-token', 'code', makeReply()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token type is not temp', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'access',
      });

      await expect(
        service.verifyTwoFactorBackup('token', 'code', makeReply()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'temp',
      });
      repo.findUserById.mockResolvedValue(null);

      await expect(
        service.verifyTwoFactorBackup('token', 'code', makeReply()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when backup code does not match', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'temp',
      });
      repo.findUserById.mockResolvedValue(mockUser());
      repo.findMatchingBackupCode.mockResolvedValue(null);

      await expect(
        service.verifyTwoFactorBackup('token', 'bad-code', makeReply()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues tokens on success', async () => {
      const user = mockUser();
      const res = mockFastifyReply();
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'u@e.com',
        role: 'USER',
        type: 'temp',
      });
      repo.findUserById.mockResolvedValue(user);
      repo.findMatchingBackupCode.mockResolvedValue({ id: 1 });

      const result = await service.verifyTwoFactorBackup(
        'token',
        'valid-code',
        res as unknown as FastifyReply,
      );

      expect(repo.storeRefreshToken).toHaveBeenCalled();
      expect(res.setCookie).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        user: { id: user.id },
      });
    });
  });

  describe('regenerateBackupCodes', () => {
    it('throws UnauthorizedException when user not found or no secret', async () => {
      repo.findUserById.mockResolvedValue(mockUser({ twoFactorSecret: null }));

      await expect(service.regenerateBackupCodes(1, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when TOTP code invalid', async () => {
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorSecret: 'SECRET' }),
      );
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(service.regenerateBackupCodes(1, 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('generates 8 codes, hashes and stores them', async () => {
      repo.findUserById.mockResolvedValue(
        mockUser({ twoFactorSecret: 'SECRET' }),
      );
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-code');
      repo.deleteBackupCodes.mockResolvedValue(undefined);
      repo.createBackupCodes.mockResolvedValue(undefined);

      const codes = await service.regenerateBackupCodes(1, '123456');

      expect(repo.deleteBackupCodes).toHaveBeenCalledWith(1);
      expect(repo.createBackupCodes).toHaveBeenCalledWith(1, expect.any(Array));
      expect(codes).toHaveLength(8);
      codes.forEach((c) => expect(typeof c).toBe('string'));
    });
  });

  describe('setupTwoFactor', () => {
    it('generates secret and returns QR code URL', async () => {
      repo.findUserById.mockResolvedValue(mockUser());
      (speakeasy.generateSecret as jest.Mock).mockReturnValue({
        base32: 'BASE32SECRET',
        otpauth_url: 'otpauth://totp/test',
      });
      repo.setTwoFactorSecret.mockResolvedValue(undefined);

      const result = await service.setupTwoFactor(1);

      expect(repo.setTwoFactorSecret).toHaveBeenCalledWith(1, 'BASE32SECRET');
      expect(result.qrCodeUrl).toBe('data:image/png;base64,mock');
      expect(result.secret).toBe('BASE32SECRET');
    });

    it('throws UnauthorizedException when user not found', async () => {
      repo.findUserById.mockResolvedValue(null);

      await expect(service.setupTwoFactor(99)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
