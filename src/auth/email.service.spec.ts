jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { EmailService } from './email.service';

const mockCreateTransport = createTransport as jest.MockedFunction<
  typeof createTransport
>;

interface MailOptions {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

const makeSendMail = () =>
  jest
    .fn<Promise<{ messageId: string }>, [MailOptions]>()
    .mockResolvedValue({ messageId: 'test' });

const makeConfig = (overrides: Record<string, unknown> = {}) => ({
  get: jest.fn((key: string) => {
    const values: Record<string, unknown> = {
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
      SMTP_FROM: 'noreply@test.com',
      FRONTEND_URL: 'https://app.example.com',
      ...overrides,
    };
    return values[key];
  }),
});

describe('EmailService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('when SMTP configured', () => {
    let service: EmailService;
    let sendMail: ReturnType<typeof makeSendMail>;

    beforeEach(async () => {
      sendMail = makeSendMail();
      mockCreateTransport.mockReturnValue({
        sendMail,
      } as unknown as ReturnType<typeof createTransport>);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: makeConfig() },
        ],
      }).compile();

      service = module.get<EmailService>(EmailService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('calls createTransport with SMTP config', () => {
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.example.com', port: 587 }),
      );
    });

    it('sendPasswordReset sends email with reset URL', async () => {
      await service.sendPasswordReset('user@example.com', 'abc123');

      const arg = sendMail.mock.calls[0][0];
      expect(arg.to).toBe('user@example.com');
      expect(arg.from).toBe('noreply@test.com');
      expect(arg.subject).toBe('Reset your TTC password');
      expect(arg.text).toContain('abc123');
      expect(arg.html).toContain('abc123');
    });

    it('includes FRONTEND_URL in reset link', async () => {
      await service.sendPasswordReset('user@example.com', 'tok');

      const arg = sendMail.mock.calls[0][0];
      expect(arg.text).toContain(
        'https://app.example.com/reset-password?token=tok',
      );
    });

    it('uses secure: true when port is 465', async () => {
      mockCreateTransport.mockClear();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: makeConfig({ SMTP_PORT: 465 }) },
        ],
      }).compile();
      module.get<EmailService>(EmailService);

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true }),
      );
    });
  });

  describe('when SMTP not configured', () => {
    let service: EmailService;

    beforeEach(async () => {
      mockCreateTransport.mockClear();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: makeConfig({ SMTP_HOST: undefined }),
          },
        ],
      }).compile();

      service = module.get<EmailService>(EmailService);
    });

    it('does not call createTransport', () => {
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('sendPasswordReset logs and returns without sending', async () => {
      const logSpy = jest.spyOn(Logger, 'log').mockImplementation(() => {});

      await expect(
        service.sendPasswordReset('u@e.com', 'tok'),
      ).resolves.toBeUndefined();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('tok'),
        'EmailService',
      );

      logSpy.mockRestore();
    });

    it('falls back to localhost:5173 in reset URL when no FRONTEND_URL', async () => {
      const logSpy = jest.spyOn(Logger, 'log').mockImplementation(() => {});
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: makeConfig({
              SMTP_HOST: undefined,
              FRONTEND_URL: undefined,
            }),
          },
        ],
      }).compile();
      const svc = module.get<EmailService>(EmailService);

      await svc.sendPasswordReset('u@e.com', 'tok2');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('localhost:5173'),
        'EmailService',
      );

      logSpy.mockRestore();
    });
  });
});
