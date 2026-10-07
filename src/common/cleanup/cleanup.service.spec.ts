import { Test, TestingModule } from '@nestjs/testing';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb } from '../../prisma8/timestamp';
import { CleanupService } from './cleanup.service';

// Deletion itself is covered against a real database in
// cleanup.service.int-spec.ts; this covers cutoffs, logging and error handling.

type WhereFn = (row: Record<string, { lt(v: string): string }>) => string;

function deleteTarget() {
  const deleteAndCount = jest.fn().mockResolvedValue(0);
  const where = jest.fn((_fn: WhereFn) => ({ deleteAndCount }));
  /** The cutoff the service compared against, as a Date. */
  const cutoff = () => {
    const fn = where.mock.calls[0][0];
    return fromDb(fn(new Proxy({}, { get: () => ({ lt: (v: string) => v }) })));
  };
  return { where, deleteAndCount, cutoff };
}

describe('CleanupService', () => {
  let service: CleanupService;
  let tokens: ReturnType<typeof deleteTarget>;
  let logs: ReturnType<typeof deleteTarget>;

  beforeEach(async () => {
    tokens = deleteTarget();
    logs = deleteTarget();
    const db = {
      orm: {
        public: {
          PasswordResetToken: { where: tokens.where },
          AuditLog: { where: logs.where },
        },
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [CleanupService, { provide: Prisma8Service, useValue: db }],
    }).compile();
    service = module.get(CleanupService);
  });

  afterEach(() => {
    delete process.env['AUDIT_RETENTION_DAYS'];
  });

  describe('purgeExpiredPasswordResetTokens', () => {
    it('cuts off at the current time', async () => {
      const before = Date.now();
      await service.purgeExpiredPasswordResetTokens();
      const cutoff = tokens.cutoff().getTime();
      expect(cutoff).toBeGreaterThanOrEqual(before - 1);
      expect(cutoff).toBeLessThanOrEqual(Date.now() + 1);
    });

    it('logs the count on success', async () => {
      tokens.deleteAndCount.mockResolvedValue(7);
      const logSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => {});
      await service.purgeExpiredPasswordResetTokens();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('7'));
    });

    it('swallows and logs errors', async () => {
      tokens.deleteAndCount.mockRejectedValue(new Error('timeout'));
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});
      await expect(
        service.purgeExpiredPasswordResetTokens(),
      ).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('password reset tokens'),
        expect.stringContaining('timeout'),
      );
    });
  });

  describe('purgeOldAuditLogs', () => {
    it('cuts off AUDIT_RETENTION_DAYS ago', async () => {
      process.env['AUDIT_RETENTION_DAYS'] = '30';
      await service.purgeOldAuditLogs();
      expect(
        Math.abs(logs.cutoff().getTime() - (Date.now() - 30 * 86_400_000)),
      ).toBeLessThan(1000);
    });

    it('defaults to 90 days', async () => {
      await service.purgeOldAuditLogs();
      expect(
        Math.abs(logs.cutoff().getTime() - (Date.now() - 90 * 86_400_000)),
      ).toBeLessThan(1000);
    });

    it('logs count and retention days on success', async () => {
      process.env['AUDIT_RETENTION_DAYS'] = '60';
      logs.deleteAndCount.mockResolvedValue(5);
      const logSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation(() => {});
      await service.purgeOldAuditLogs();
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/5.*60|60.*5/));
    });

    it('swallows and logs errors', async () => {
      logs.deleteAndCount.mockRejectedValue(new Error('DB down'));
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});
      await expect(service.purgeOldAuditLogs()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('audit logs'),
        expect.stringContaining('DB down'),
      );
    });
  });
});
