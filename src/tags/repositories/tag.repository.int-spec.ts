import { NotFoundException } from '@nestjs/common';
import { useTestDb } from '../../prisma8/testing/test-db';
import { seedTag, seedUser } from '../../prisma8/testing/seed';
import { Prisma8TagRepository } from './prisma8-tag.repository';
import { TagRepository } from './tag.repository';
import { anyDate, anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  ['prisma8', (): TagRepository => new Prisma8TagRepository(db.prisma8)],
])('TagRepository (%s)', (_impl, make) => {
  let repo: TagRepository;
  let owner: number;
  let other: number;

  beforeEach(async () => {
    repo = make();
    owner = (await seedUser(db.prisma8)).id;
    other = (await seedUser(db.prisma8)).id;
  });

  describe('findAll', () => {
    it("returns only the user's tags, sorted by name", async () => {
      await seedTag(db.prisma8, owner, 'zeta');
      await seedTag(db.prisma8, owner, 'alpha');
      await seedTag(db.prisma8, other, 'beta');

      const tags = await repo.findAll(owner);

      expect(tags.map((t) => t.name)).toEqual(['alpha', 'zeta']);
      expect(tags[0]).toEqual({
        id: anyNumber,
        userId: owner,
        name: 'alpha',
        createdAt: anyDate,
      });
    });
  });

  describe('findById', () => {
    it("returns the user's tag", async () => {
      const { id } = await seedTag(db.prisma8, owner, 'alpha');
      await expect(repo.findById(id, owner)).resolves.toMatchObject({
        id,
        name: 'alpha',
      });
    });

    it("throws NotFound for another user's tag", async () => {
      const { id } = await seedTag(db.prisma8, other, 'beta');
      await expect(repo.findById(id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('trims the name and stamps createdAt', async () => {
      const tag = await repo.create(owner, '  urgent  ');
      expect(tag).toMatchObject({ userId: owner, name: 'urgent' });
      expect(tag.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('renames with a trimmed name', async () => {
      const { id } = await seedTag(db.prisma8, owner, 'old');
      await expect(repo.update(id, owner, ' new ')).resolves.toMatchObject({
        id,
        name: 'new',
      });
    });

    it("renames only that tag, not the user's others", async () => {
      await seedTag(db.prisma8, owner, 'other');
      const { id } = await seedTag(db.prisma8, owner, 'old');
      await repo.update(id, owner, 'new');
      await expect(
        repo.findAll(owner).then((t) => t.map((x) => x.name)),
      ).resolves.toEqual(['new', 'other']);
    });

    it("throws NotFound for another user's tag and leaves it unchanged", async () => {
      const { id } = await seedTag(db.prisma8, other, 'keep');
      await expect(repo.update(id, owner, 'hacked')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect((await repo.findById(id, other)).name).toBe('keep');
    });
  });

  describe('delete', () => {
    it('removes only that tag', async () => {
      await seedTag(db.prisma8, owner, 'kept');
      const { id } = await seedTag(db.prisma8, owner, 'gone');
      await repo.delete(id, owner);
      await expect(
        repo.findAll(owner).then((t) => t.map((x) => x.name)),
      ).resolves.toEqual(['kept']);
    });

    it("throws NotFound for another user's tag and keeps it", async () => {
      const { id } = await seedTag(db.prisma8, other, 'keep');
      await expect(repo.delete(id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.findAll(other)).resolves.toHaveLength(1);
    });
  });
});
