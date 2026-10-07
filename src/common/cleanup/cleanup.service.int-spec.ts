import { seedUser } from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { toDb } from '../../prisma8/timestamp';
import { CleanupService } from './cleanup.service';

const db = useTestDb();
const day = 86_400_000;
const ago = (days: number) => toDb(new Date(Date.now() - days * day));

describe.each([['prisma8', () => new CleanupService(db.prisma8)]])(
  'CleanupService (%s)',
  (_impl, make) => {
    let service: CleanupService;
    let user: number;

    beforeEach(async () => {
      service = make();
      user = (await seedUser(db.prisma8)).id;
    });

    afterEach(() => {
      delete process.env['AUDIT_RETENTION_DAYS'];
    });

    it('purges only expired password reset tokens', async () => {
      await db.prisma8.orm.public.PasswordResetToken.create({
        userId: user,
        tokenHash: 'old',
        expiresAt: ago(1),
      });
      await db.prisma8.orm.public.PasswordResetToken.create({
        userId: user,
        tokenHash: 'live',
        expiresAt: ago(-1),
      });

      await service.purgeExpiredPasswordResetTokens();

      const left = await db.prisma8.orm.public.PasswordResetToken.all();
      expect(left.map((t) => t.tokenHash)).toEqual(['live']);
    });

    it('purges audit logs older than the retention, 90 days by default', async () => {
      const log = (action: string, days: number) =>
        db.prisma8.orm.public.AuditLog.create({
          userId: user,
          action,
          resource: 'R',
          createdAt: ago(days),
        });
      await log('old', 91);
      await log('recent', 89);

      await service.purgeOldAuditLogs();
      await expect(
        db.prisma8.orm.public.AuditLog.all().then((r) =>
          r.map((l) => l.action),
        ),
      ).resolves.toEqual(['recent']);

      process.env['AUDIT_RETENTION_DAYS'] = '30';
      await service.purgeOldAuditLogs();
      await expect(db.prisma8.orm.public.AuditLog.all()).resolves.toEqual([]);
    });
  },
);
