import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { GoogleProfile } from './strategies/google.strategy';
import { mockFastifyReply } from '../__test-helpers__/mock-factories';

const makeReq = (user: GoogleProfile) =>
  ({ user }) as unknown as FastifyRequest & { user: GoogleProfile };
const makeRes = () => mockFastifyReply() as unknown as FastifyReply;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { googleCallback: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    authService = { googleCallback: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleLogin', () => {
    it('returns nothing — guard handles redirect', () => {
      const result = controller.googleLogin();
      expect(result).toBeUndefined();
    });
  });

  describe('googleCallback', () => {
    const profile = {
      providerId: 'g-123',
      email: 'g@example.com',
      name: 'Google User',
    };

    it('calls authService.googleCallback with profile and reply', async () => {
      configService.get.mockReturnValue('https://app.example.com');
      const res = makeRes();
      const req = makeReq(profile);

      await controller.googleCallback(req, res);

      expect(authService.googleCallback).toHaveBeenCalledWith(profile, res);
    });

    it('returns redirect to FRONTEND_URL', async () => {
      configService.get.mockReturnValue('https://app.example.com');

      const result = await controller.googleCallback(
        makeReq(profile),
        makeRes(),
      );

      expect(result).toEqual({
        url: 'https://app.example.com',
        statusCode: 302,
      });
    });

    it('falls back to localhost:5173 when FRONTEND_URL not set', async () => {
      configService.get.mockReturnValue(undefined);

      const result = await controller.googleCallback(
        makeReq(profile),
        makeRes(),
      );

      expect(result).toEqual({ url: 'http://localhost:5173', statusCode: 302 });
    });
  });
});
