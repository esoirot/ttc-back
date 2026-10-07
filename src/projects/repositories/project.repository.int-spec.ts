import { NotFoundException } from '@nestjs/common';
import { ProjectStatus } from '../entities/project.entity';
import { toNumeric } from '../../prisma8/numeric';
import {
  seedClient,
  seedOccupation,
  seedProject,
  seedUser,
} from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { PrismaProjectRepository } from './prisma-project.repository';
import { Prisma8ProjectRepository } from './prisma8-project.repository';
import { ProjectRepository } from './projects.repository';

const db = useTestDb();

describe.each([
  ['prisma7', (): ProjectRepository => new PrismaProjectRepository(db.prisma7)],
  [
    'prisma8',
    (): ProjectRepository => new Prisma8ProjectRepository(db.prisma8),
  ],
])('ProjectRepository (%s)', (_impl, make) => {
  let repo: ProjectRepository;
  let owner: number;
  let stranger: number;

  const link = (projectId: number, occupationId: number) =>
    db.prisma8.orm.public.ProjectOccupation.create({ projectId, occupationId });

  // A third user's project, created first: a write or read that loses its
  // filter lands here.
  let decoy: Awaited<ReturnType<typeof seedProject>>;

  beforeEach(async () => {
    repo = make();
    decoy = await seedProject(db.prisma8, (await seedUser(db.prisma8)).id, {
      title: 'decoy',
    });
    owner = (await seedUser(db.prisma8)).id;
    stranger = (await seedUser(db.prisma8)).id;
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.Project.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('findById', () => {
    it('returns the project with prices as numbers and its occupations', async () => {
      const occupation = await seedOccupation(db.prisma8, owner, 'Translator');
      const p = await seedProject(db.prisma8, owner, {
        title: 'Manual',
        fixedFee: toNumeric(1200.5),
        perWordRate: toNumeric(0.0825),
      });
      await link(p.id, occupation.id);

      const project = await repo.findById(p.id, owner);

      expect(project).toMatchObject({
        id: p.id,
        userId: owner,
        clientId: null,
        title: 'Manual',
        status: 'DRAFT',
        currency: 'EUR',
        useCustomRate: false,
        unitPrice: null,
        fixedFee: 1200.5,
        hourlyRate: null,
        perWordRate: 0.0825,
        deadline: null,
        startDate: null,
      });
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.occupations).toEqual([
        expect.objectContaining({ id: occupation.id, name: 'Translator' }),
      ]);
    });

    it("throws NotFound for someone else's project, unless no user is given", async () => {
      const p = await seedProject(db.prisma8, stranger);
      await expect(repo.findById(p.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.findById(p.id, null)).resolves.toMatchObject({
        id: p.id,
      });
    });
  });

  describe('findAll', () => {
    it("lists the user's projects by id with total and cursor", async () => {
      const ids: number[] = [];
      for (const title of ['a', 'b', 'c'])
        ids.push((await seedProject(db.prisma8, owner, { title })).id);
      await seedProject(db.prisma8, stranger);

      const page1 = await repo.findAll(owner, false, undefined, { limit: 2 });
      expect(page1.items.map((p) => p.id)).toEqual(ids.slice(0, 2));
      expect(page1).toMatchObject({ total: 3, nextCursor: ids[1] });

      const page2 = await repo.findAll(owner, false, undefined, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items.map((p) => p.id)).toEqual([ids[2]]);
      expect(page2).toMatchObject({ total: 3, nextCursor: null });
    });

    it('defaults to 20 per page', async () => {
      for (let i = 0; i < 21; i++) await seedProject(db.prisma8, owner);
      const page = await repo.findAll(owner, false);
      expect(page.items).toHaveLength(20);
      expect(page.total).toBe(21);
    });

    it("lets an admin see everyone's projects", async () => {
      await seedProject(db.prisma8, owner);
      await seedProject(db.prisma8, stranger);
      await expect(repo.findAll(owner, true)).resolves.toMatchObject({
        total: 3,
      });
    });

    it('filters by status and by case-insensitive title search', async () => {
      await seedProject(db.prisma8, owner, {
        title: 'Game Localization',
        status: 'ACTIVE',
      });
      await seedProject(db.prisma8, owner, {
        title: 'game manual',
        status: 'DRAFT',
      });
      await seedProject(db.prisma8, owner, {
        title: 'Website',
        status: 'ACTIVE',
      });

      const active = await repo.findAll(owner, false, 'ACTIVE');
      expect(active.items.map((p) => p.title).sort()).toEqual([
        'Game Localization',
        'Website',
      ]);

      const search = await repo.findAll(
        owner,
        false,
        undefined,
        undefined,
        'GAME',
      );
      expect(search.items.map((p) => p.title).sort()).toEqual([
        'Game Localization',
        'game manual',
      ]);
      expect(search.total).toBe(2);
    });
  });

  describe('search', () => {
    it('matches LIKE wildcards in the search text literally', async () => {
      await seedProject(db.prisma8, owner, { title: '100% done' });
      await seedProject(db.prisma8, owner, { title: '1000 words' });
      await seedProject(db.prisma8, owner, { title: 'a_b' });
      await seedProject(db.prisma8, owner, { title: 'axb' });

      const pct = await repo.findAll(
        owner,
        false,
        undefined,
        undefined,
        '100%',
      );
      expect(pct.items.map((p) => p.title)).toEqual(['100% done']);
      const under = await repo.findAll(
        owner,
        false,
        undefined,
        undefined,
        'a_b',
      );
      expect(under.items.map((p) => p.title)).toEqual(['a_b']);
    });
  });

  describe('create', () => {
    it('defaults status and currency and links the given occupations', async () => {
      const occupation = await seedOccupation(db.prisma8, owner);
      const client = await seedClient(db.prisma8, owner);
      const project = await repo.create(owner, {
        title: 'New',
        clientId: client.id,
        hourlyRate: 45,
        wordCount: 1000,
        deadline: new Date('2026-12-31T00:00:00.000Z'),
        occupationIds: [occupation.id],
      });
      expect(project).toMatchObject({
        userId: owner,
        clientId: client.id,
        title: 'New',
        status: 'DRAFT',
        currency: 'EUR',
        hourlyRate: 45,
        fixedFee: null,
        wordCount: 1000,
        deadline: new Date('2026-12-31T00:00:00.000Z'),
      });
      expect(project.occupations.map((o) => o.id)).toEqual([occupation.id]);
    });

    it('keeps an explicit status and currency, links nothing without occupationIds', async () => {
      const project = await repo.create(owner, {
        title: 'X',
        status: ProjectStatus.ACTIVE,
        currency: 'USD',
      });
      expect(project).toMatchObject({
        status: 'ACTIVE',
        currency: 'USD',
        occupations: [],
      });
    });
  });

  describe('update', () => {
    it('changes the given fields and moves updatedAt', async () => {
      const p = await repo.create(owner, { title: 'Old', fixedFee: 100 });
      await new Promise((r) => setTimeout(r, 5));
      const updated = await repo.update(p.id, owner, {
        id: p.id,
        title: 'New',
        fixedFee: 250.75,
        status: ProjectStatus.COMPLETED,
      });
      expect(updated).toMatchObject({
        title: 'New',
        fixedFee: 250.75,
        status: 'COMPLETED',
        currency: 'EUR',
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        p.updatedAt.getTime(),
      );
    });

    it('replaces occupations only when occupationIds is given', async () => {
      const a = await seedOccupation(db.prisma8, owner);
      const b = await seedOccupation(db.prisma8, owner);
      const p = await repo.create(owner, { title: 'P', occupationIds: [a.id] });

      const untouched = await repo.update(p.id, owner, {
        id: p.id,
        title: 'P2',
      });
      expect(untouched.occupations.map((o) => o.id)).toEqual([a.id]);

      const replaced = await repo.update(p.id, owner, {
        id: p.id,
        occupationIds: [b.id],
      });
      expect(replaced.occupations.map((o) => o.id)).toEqual([b.id]);

      const cleared = await repo.update(p.id, owner, {
        id: p.id,
        occupationIds: [],
      });
      expect(cleared.occupations).toEqual([]);
    });

    it("throws NotFound for someone else's project", async () => {
      const p = await seedProject(db.prisma8, stranger);
      await expect(
        repo.update(p.id, owner, { id: p.id, title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes and returns the project with its occupations', async () => {
      const occupation = await seedOccupation(db.prisma8, owner);
      const p = await repo.create(owner, {
        title: 'Gone',
        occupationIds: [occupation.id],
      });
      const deleted = await repo.delete(p.id, owner);
      expect(deleted).toMatchObject({ id: p.id, title: 'Gone' });
      expect(deleted.occupations.map((o) => o.id)).toEqual([occupation.id]);
      await expect(repo.findById(p.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws NotFound for someone else's project and keeps it", async () => {
      const p = await seedProject(db.prisma8, stranger);
      await expect(repo.delete(p.id, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.findById(p.id, stranger)).resolves.toMatchObject({
        id: p.id,
      });
    });
  });
});
