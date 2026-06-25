import { Test, TestingModule } from '@nestjs/testing';
import { CleanupService } from './cleanup.service';
import { PrismaService } from '../../prisma.service';

type DeleteManyArgs = {
  where: { expiresAt?: { lt: Date }; createdAt?: { lt: Date } };
};
type DeleteManyMock = jest.Mock<Promise<{ count: number }>, [DeleteManyArgs]>;

describe('CleanupService', () => {
  let service: CleanupService;
  let prisma: {
    passwordResetToken: { deleteMany: DeleteManyMock };
    auditLog: { deleteMany: DeleteManyMock };
  };

  beforeEach(async () => {
    prisma = {
      passwordResetToken: {
        deleteMany: jest
          .fn<Promise<{ count: number }>, [DeleteManyArgs]>()
          .mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        deleteMany: jest
          .fn<Promise<{ count: number }>, [DeleteManyArgs]>()
          .mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CleanupService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('purgeExpiredPasswordResetTokens', () => {
    it('deletes tokens where expiresAt < now', async () => {
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 3 });

      await service.purgeExpiredPasswordResetTokens();

      const anyDate = expect.any(Date) as unknown as Date;
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: anyDate } },
      });
    });

    it('cutoff date is before current time', async () => {
      const before = Date.now();
      await service.purgeExpiredPasswordResetTokens();
      const after = Date.now();

      const [[call]] = prisma.passwordResetToken.deleteMany.mock.calls;
      const cutoff = call.where.expiresAt!.lt;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 1);
      expect(cutoff.getTime()).toBeLessThanOrEqual(after + 1);
    });

    it('swallows prisma errors silently', async () => {
      prisma.passwordResetToken.deleteMany.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(
        service.purgeExpiredPasswordResetTokens(),
      ).resolves.toBeUndefined();
    });

    it('logs count on success', async () => {
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 7 });
      const logSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => {});

      await service.purgeExpiredPasswordResetTokens();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('7'));
      logSpy.mockRestore();
    });

    it('logs error on failure', async () => {
      prisma.passwordResetToken.deleteMany.mockRejectedValue(
        new Error('timeout'),
      );
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      await service.purgeExpiredPasswordResetTokens();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('password reset tokens'),
        expect.stringContaining('timeout'),
      );
      errorSpy.mockRestore();
    });
  });

  describe('purgeOldAuditLogs', () => {
    it('deletes audit logs older than AUDIT_RETENTION_DAYS', async () => {
      const savedEnv = process.env['AUDIT_RETENTION_DAYS'];
      process.env['AUDIT_RETENTION_DAYS'] = '30';
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 12 });

      await service.purgeOldAuditLogs();

      const [[call]] = prisma.auditLog.deleteMany.mock.calls;
      const cutoff = call.where.createdAt!.lt;
      const expectedCutoff = Date.now() - 30 * 86_400_000;
      expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(1000);

      process.env['AUDIT_RETENTION_DAYS'] = savedEnv;
    });

    it('defaults to 90 days when env not set', async () => {
      const savedEnv = process.env['AUDIT_RETENTION_DAYS'];
      delete process.env['AUDIT_RETENTION_DAYS'];

      await service.purgeOldAuditLogs();

      const [[call]] = prisma.auditLog.deleteMany.mock.calls;
      const cutoff = call.where.createdAt!.lt;
      const expectedCutoff = Date.now() - 90 * 86_400_000;
      expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(1000);

      process.env['AUDIT_RETENTION_DAYS'] = savedEnv;
    });

    it('swallows prisma errors silently', async () => {
      prisma.auditLog.deleteMany.mockRejectedValue(new Error('DB down'));

      await expect(service.purgeOldAuditLogs()).resolves.toBeUndefined();
    });

    it('logs count and retention days on success', async () => {
      const savedEnv = process.env['AUDIT_RETENTION_DAYS'];
      process.env['AUDIT_RETENTION_DAYS'] = '60';
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });
      const logSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => {});

      await service.purgeOldAuditLogs();

      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/5.*60|60.*5/));

      logSpy.mockRestore();
      process.env['AUDIT_RETENTION_DAYS'] = savedEnv;
    });

    it('logs error on failure', async () => {
      prisma.auditLog.deleteMany.mockRejectedValue(new Error('locked'));
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      await service.purgeOldAuditLogs();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('audit logs'),
        expect.stringContaining('locked'),
      );
      errorSpy.mockRestore();
    });
  });
});
