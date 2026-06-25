import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';

jest.mock('passport-local', () => ({
  Strategy: class {
    constructor() {}
  },
}));

const makeAuthUser = () => ({
  id: 1,
  email: 'user@example.com',
  role: 'USER',
  twoFactorEnabled: false,
});

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: { validateUser: jest.Mock };

  beforeEach(() => {
    authService = { validateUser: jest.fn() };
    strategy = new LocalStrategy(authService as unknown as AuthService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('validate — returns user when credentials valid', async () => {
    const user = makeAuthUser();
    authService.validateUser.mockResolvedValue(user);

    const result = await strategy.validate('user@example.com', 'password');

    expect(authService.validateUser).toHaveBeenCalledWith(
      'user@example.com',
      'password',
    );
    expect(result).toEqual(user);
  });

  it('validate — throws UnauthorizedException when credentials invalid', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(strategy.validate('bad@example.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
