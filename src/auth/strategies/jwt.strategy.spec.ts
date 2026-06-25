import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import type { JwtPayload } from '../types/jwt-payload.type';

jest.mock('passport-jwt', () => ({
  ExtractJwt: { fromExtractors: jest.fn().mockReturnValue(() => null) },
  Strategy: class {
    constructor() {}
  },
}));

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    configService = { getOrThrow: jest.fn().mockReturnValue('test-secret') };
    strategy = new JwtStrategy(configService as unknown as ConfigService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('validate — returns user data for valid access token', () => {
    const payload: JwtPayload = {
      sub: 42,
      email: 'user@example.com',
      role: 'USER',
      type: 'access',
    };

    const result = strategy.validate(payload);

    expect(result).toEqual({ id: 42, email: 'user@example.com', role: 'USER' });
  });

  it('validate — throws UnauthorizedException for an unexpected token type', () => {
    const payload = {
      sub: 42,
      email: 'user@example.com',
      role: 'USER',
      type: 'refresh',
    } as unknown as JwtPayload;

    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });

  it('validate — throws UnauthorizedException when type is temp', () => {
    const payload: JwtPayload = {
      sub: 42,
      email: 'user@example.com',
      role: 'USER',
      type: 'temp',
    };

    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });
});
