import { seedUser } from '../prisma8/testing/seed';
import { useTestDb } from '../prisma8/testing/test-db';
import { AuditService } from './audit.service';
import { anyDate } from '../prisma8/testing/matchers';

const db = useTestDb();

async function eventually<T>(
  read: () => Promise<T>,
  done: (v: T) => boolean,
): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('condition not reached');
}

describe.each([['prisma8', () => new AuditService(db.prisma8)]])(
  'AuditService (%s)',
  (_impl, make) => {
    let service: AuditService;
    let user: { id: number; email: string };

    beforeEach(async () => {
      service = make();
      user = await seedUser(db.prisma8);
    });

    it('writes an entry in the background, with or without a JSON payload', async () => {
      service.log(user.id, 'CREATE', 'Client', { id: 7, name: 'ACME' });
      service.log(user.id, 'LOGIN', 'Auth');

      const { items } = await eventually(
        () => service.findAll({}),
        (r) => r.items.length === 2,
      );

      expect(items.map((e) => [e.action, e.resource, e.payload])).toEqual(
        expect.arrayContaining([
          ['CREATE', 'Client', { id: 7, name: 'ACME' }],
          ['LOGIN', 'Auth', null],
        ]),
      );
      expect(items[0]).toMatchObject({
        userId: user.id,
        user: { email: user.email },
        createdAt: anyDate,
      });
    });

    it('never throws, even when the write fails', async () => {
      expect(() => service.log(999999, 'X', 'Y')).not.toThrow();
      await new Promise((r) => setTimeout(r, 100));
      await expect(service.findAll({})).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it('returns 50 entries per page by default', async () => {
      for (let i = 0; i < 51; i++) {
        await db.prisma8.orm.public.AuditLog.create({
          userId: user.id,
          action: `a${i}`,
          resource: 'R',
        });
      }
      const page = await service.findAll({});
      expect(page.items).toHaveLength(50);
      expect(page.nextCursor).toBe(page.items[49].id);
    });

    it('lists newest first, filters by user, pages with an id-below cursor', async () => {
      const other = await seedUser(db.prisma8);
      const create = (userId: number, action: string) =>
        db.prisma8.orm.public.AuditLog.create({
          userId,
          action,
          resource: 'R',
        });
      const a = await create(user.id, 'a');
      const b = await create(other.id, 'b');
      const c = await create(user.id, 'c');

      await expect(
        service.findAll({}).then((r) => r.items.map((e) => e.id)),
      ).resolves.toEqual([c.id, b.id, a.id]);
      await expect(
        service
          .findAll({ userId: user.id })
          .then((r) => r.items.map((e) => e.action)),
      ).resolves.toEqual(['c', 'a']);
      const page1 = await service.findAll({ limit: 2 });
      expect(page1.nextCursor).toBe(b.id);
      await expect(
        service.findAll({ limit: 2, cursor: b.id }),
      ).resolves.toMatchObject({
        items: [expect.objectContaining({ id: a.id })],
        nextCursor: null,
      });
    });
  },
);
