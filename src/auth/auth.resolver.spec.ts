import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { mockUser, mockFastifyReply } from '../__test-helpers__/mock-factories';

type AuthResolverCtx = Parameters<AuthResolver['login']>[1];

const makeCtx = (overrides: Record<string, unknown> = {}) =>
  ({
    req: { cookies: {} },
    res: mockFastifyReply(),
    ...overrides,
  }) as unknown as AuthResolverCtx;

const mockAuthService = () => ({
  getUser: jest.fn(),
  updateMe: jest.fn(),
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  validateUser: jest.fn(),
  setupTwoFactor: jest.fn(),
  enableTwoFactor: jest.fn(),
  disableTwoFactor: jest.fn(),
  verifyTwoFactor: jest.fn(),
  verifyTwoFactorBackup: jest.fn(),
  regenerateBackupCodes: jest.fn(),
  adminDisableTwoFactor: jest.fn(),
  getBackupCodeCount: jest.fn(),
  changePassword: jest.fn(),
  deleteAccount: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
});

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let service: ReturnType<typeof mockAuthService>;

  const user = { id: 1, role: 'USER' };

  beforeEach(async () => {
    service = mockAuthService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthResolver, { provide: AuthService, useValue: service }],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('me — returns user from service', async () => {
    const authUser = mockUser();
    service.getUser.mockResolvedValue(authUser);

    const result = await resolver.me(user);
    expect(service.getUser).toHaveBeenCalledWith(1);
    expect(result).toEqual(authUser);
  });

  it('updateMe — delegates to service', async () => {
    const updated = mockUser({ name: 'Updated' });
    service.updateMe.mockResolvedValue(updated);

    const result = await resolver.updateMe(user, { name: 'Updated' });
    expect(service.updateMe).toHaveBeenCalledWith(1, { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  describe('register', () => {
    it('registers and auto-logs in, returns user', async () => {
      const authUser = mockUser();
      const loginRes = { user: mockUser() };
      const res = mockFastifyReply();
      service.register.mockResolvedValue(authUser);
      service.login.mockResolvedValue(loginRes);

      const result = await resolver.register(
        { email: 'a@b.com', password: 'pass', name: 'Alice' },
        makeCtx({ res }),
      );

      expect(service.register).toHaveBeenCalledWith('a@b.com', 'pass', 'Alice');
      expect(service.login).toHaveBeenCalledWith(authUser, res);
      expect(result).toEqual(loginRes.user);
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when credentials invalid', async () => {
      service.validateUser.mockResolvedValue(null);

      await expect(
        resolver.login({ email: 'a@b.com', password: 'bad' }, makeCtx()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns login response on success', async () => {
      const authUser = mockUser();
      service.validateUser.mockResolvedValue(authUser);
      service.login.mockResolvedValue({ user: authUser });

      const result = await resolver.login(
        { email: 'a@b.com', password: 'pass' },
        makeCtx(),
      );
      expect(result).toEqual({ user: authUser });
    });
  });

  it('logout — delegates to service', async () => {
    service.logout.mockResolvedValue(true);
    const res = mockFastifyReply();

    const result = await resolver.logout(user, makeCtx({ res }));
    expect(service.logout).toHaveBeenCalledWith(1, res);
    expect(result).toBe(true);
  });

  it('refreshToken — reads cookie and delegates', async () => {
    service.refresh.mockResolvedValue(true);
    const req = { cookies: { refresh_token: 'rt' } };
    const res = mockFastifyReply();

    const result = await resolver.refreshToken(makeCtx({ req, res }));
    expect(service.refresh).toHaveBeenCalledWith('rt', res);
    expect(result).toBe(true);
  });

  it('setupTwoFactor — delegates to service', async () => {
    service.setupTwoFactor.mockResolvedValue({
      qrCodeUrl: 'url',
      secret: 'sec',
    });

    const result = await resolver.setupTwoFactor(user);
    expect(service.setupTwoFactor).toHaveBeenCalledWith(1);
    expect(result).toEqual({ qrCodeUrl: 'url', secret: 'sec' });
  });

  it('enableTwoFactor — wraps backup codes in object', async () => {
    service.enableTwoFactor.mockResolvedValue(['code1', 'code2']);

    const result = await resolver.enableTwoFactor(user, '123456');
    expect(service.enableTwoFactor).toHaveBeenCalledWith(1, '123456');
    expect(result).toEqual({ backupCodes: ['code1', 'code2'] });
  });

  it('disableTwoFactor — delegates to service', async () => {
    service.disableTwoFactor.mockResolvedValue(true);

    const result = await resolver.disableTwoFactor(user, '123456');
    expect(service.disableTwoFactor).toHaveBeenCalledWith(1, '123456');
    expect(result).toBe(true);
  });

  it('verifyTwoFactor — delegates to service', async () => {
    const loginRes = { user: mockUser() };
    service.verifyTwoFactor.mockResolvedValue(loginRes);
    const res = mockFastifyReply();

    const result = await resolver.verifyTwoFactor(
      { tempToken: 'tok', code: '123456' },
      makeCtx({ res }),
    );
    expect(service.verifyTwoFactor).toHaveBeenCalledWith('tok', '123456', res);
    expect(result).toEqual(loginRes);
  });

  it('verifyTwoFactorBackup — delegates to service', async () => {
    const loginRes = { user: mockUser() };
    service.verifyTwoFactorBackup.mockResolvedValue(loginRes);
    const res = mockFastifyReply();

    const result = await resolver.verifyTwoFactorBackup(
      { tempToken: 'tok', backupCode: 'bc' },
      makeCtx({ res }),
    );
    expect(service.verifyTwoFactorBackup).toHaveBeenCalledWith(
      'tok',
      'bc',
      res,
    );
    expect(result).toEqual(loginRes);
  });

  it('regenerateBackupCodes — wraps backup codes in object', async () => {
    service.regenerateBackupCodes.mockResolvedValue(['c1', 'c2']);

    const result = await resolver.regenerateBackupCodes(user, '123456');
    expect(service.regenerateBackupCodes).toHaveBeenCalledWith(1, '123456');
    expect(result).toEqual({ backupCodes: ['c1', 'c2'] });
  });

  it('adminDisableTwoFactor — delegates to service with admin+target ids', async () => {
    service.adminDisableTwoFactor.mockResolvedValue(true);

    const result = await resolver.adminDisableTwoFactor({ id: 99 }, 5);
    expect(service.adminDisableTwoFactor).toHaveBeenCalledWith(99, 5);
    expect(result).toBe(true);
  });

  it('backupCodeCount — delegates to service', async () => {
    service.getBackupCodeCount.mockResolvedValue(6);

    const result = await resolver.backupCodeCount(user);
    expect(service.getBackupCodeCount).toHaveBeenCalledWith(1);
    expect(result).toBe(6);
  });

  it('changePassword — delegates to service', async () => {
    service.changePassword.mockResolvedValue(true);

    const result = await resolver.changePassword(user, 'old', 'new');
    expect(service.changePassword).toHaveBeenCalledWith(1, 'old', 'new');
    expect(result).toBe(true);
  });

  it('deleteAccount — delegates to service', async () => {
    service.deleteAccount.mockResolvedValue(true);
    const res = mockFastifyReply();

    const result = await resolver.deleteAccount(user, makeCtx({ res }));
    expect(service.deleteAccount).toHaveBeenCalledWith(1, res);
    expect(result).toBe(true);
  });

  it('requestPasswordReset — delegates to service', async () => {
    service.requestPasswordReset.mockResolvedValue(true);

    const result = await resolver.requestPasswordReset('a@b.com');
    expect(service.requestPasswordReset).toHaveBeenCalledWith('a@b.com');
    expect(result).toBe(true);
  });

  it('resetPassword — delegates to service', async () => {
    service.resetPassword.mockResolvedValue(true);

    const result = await resolver.resetPassword('token', 'newpass');
    expect(service.resetPassword).toHaveBeenCalledWith('token', 'newpass');
    expect(result).toBe(true);
  });
});
