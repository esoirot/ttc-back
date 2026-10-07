import { Prisma8Service } from './prisma8.service';

describe('Prisma8Service', () => {
  let db: Prisma8Service;

  beforeAll(() => {
    db = new Prisma8Service();
  });

  afterAll(async () => {
    await db.onModuleDestroy();
  });

  it('runs an ORM query against the test database', async () => {
    const users = await db.orm.public.User.all();
    expect(Array.isArray(users)).toBe(true);
  });
});
