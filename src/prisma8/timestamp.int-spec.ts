import { PrismaService } from '../prisma.service';
import { Prisma8Service } from './prisma8.service';
import { resetDb } from './testing/reset-db';
import { fromDb, toDb } from './timestamp';

describe('timestamps across Prisma 7 and Prisma 8', () => {
  const prisma7 = new PrismaService();
  const prisma8 = new Prisma8Service();
  const instant = new Date('2026-10-07T08:15:30.123Z');

  beforeEach(resetDb);

  afterAll(async () => {
    await prisma7.$disconnect();
    await prisma8.onModuleDestroy();
  });

  it('reads a Prisma 7 write as the same instant', async () => {
    const { id } = await prisma7.user.create({
      data: { email: 'a@test.io', updatedAt: instant },
    });

    const row = await prisma8.orm.public.User.first({ id });

    expect(fromDb(row!.updatedAt)).toEqual(instant);
  });

  it('writes an instant Prisma 7 reads back unchanged', async () => {
    const created = await prisma8.orm.public.User.create({
      email: 'b@test.io',
      updatedAt: toDb(instant),
    });

    const row = await prisma7.user.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(row.updatedAt).toEqual(instant);
  });
});
