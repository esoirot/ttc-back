import { Client } from 'pg';
import { Prisma8Service } from './prisma8.service';
import { resetDb } from './testing/reset-db';
import { fromDb, toDb } from './timestamp';

// Prisma 7 stored instants as UTC wall time in `timestamp` columns; rows it
// wrote must keep meaning the same instant now that Prisma 8 reads them.
describe('timestamps in the database', () => {
  const prisma8 = new Prisma8Service();
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  const instant = new Date('2026-10-07T08:15:30.123Z');

  beforeAll(() => sql.connect());
  beforeEach(resetDb);

  afterAll(async () => {
    await sql.end();
    await prisma8.onModuleDestroy();
  });

  it('reads a UTC wall-time row as that instant', async () => {
    const { rows } = await sql.query<{ id: number }>(
      `insert into "User" (email, "updatedAt")
       values ('a@test.io', '2026-10-07 08:15:30.123') returning id`,
    );

    const row = await prisma8.orm.public.User.first({ id: rows[0].id });

    expect(fromDb(row!.updatedAt)).toEqual(instant);
  });

  it('writes an instant as UTC wall time', async () => {
    const created = await prisma8.orm.public.User.create({
      email: 'b@test.io',
      updatedAt: toDb(instant),
    });

    const { rows } = await sql.query<{ updatedAt: string }>(
      `select "updatedAt"::text as "updatedAt" from "User" where id = $1`,
      [created.id],
    );

    expect(rows[0].updatedAt).toBe('2026-10-07 08:15:30.123');
  });
});
