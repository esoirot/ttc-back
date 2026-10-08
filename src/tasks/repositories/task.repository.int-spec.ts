import { NotFoundException } from '@nestjs/common';
import { seedProject, seedTask, seedUser } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { fromDb } from '../../prisma8/timestamp';
import { TaskStatus } from '../entities/task.entity';
import { Prisma8TaskRepository } from './prisma8-task.repository';
import { TaskRepository } from './task.repository';

const db = useTestDb();

describe.each([
  ['prisma8', (): TaskRepository => new Prisma8TaskRepository(db.prisma8)],
])('TaskRepository (%s)', (_impl, make) => {
  let repo: TaskRepository;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;

  const titles = (page: { items: { title: string }[] }) =>
    page.items.map((t) => t.title);

  // Another user's task, created first: a write that loses its filter lands here.
  let decoy: Awaited<ReturnType<typeof seedTask>>;

  beforeEach(async () => {
    repo = make();
    const other = await seedUser(db.prisma8);
    decoy = await seedTask(
      db.prisma8,
      (await seedProject(db.prisma8, other.id)).id,
      // Last in sort order, so a cursor wrongly taken from it empties the page.
      { title: 'decoy', status: 'PAID' },
    );
    s = await seedTaskAccess(db.prisma8);
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.Task.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('findById', () => {
    it('returns the task to the project owner', async () => {
      const task = await repo.findById(s.task, s.owner);
      expect(task).toMatchObject({
        id: s.task,
        projectId: s.project,
        status: 'TODO',
        description: null,
        dueDate: null,
        wordCount: null,
        sortOrder: 0,
        checklistTitles: [],
      });
      expect(task.createdAt).toBeInstanceOf(Date);
    });

    it('throws NotFound for a stranger', async () => {
      await expect(repo.findById(s.task, s.stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findByProject', () => {
    it('orders by status, then sortOrder, then id', async () => {
      const p = await seedProject(db.prisma8, s.owner);
      await seedTask(db.prisma8, p.id, { title: 'done', status: 'DONE' });
      await seedTask(db.prisma8, p.id, { title: 'todo-2', sortOrder: 2 });
      await seedTask(db.prisma8, p.id, {
        title: 'doing',
        status: 'IN_PROGRESS',
      });
      await seedTask(db.prisma8, p.id, { title: 'todo-1', sortOrder: 1 });
      await seedTask(db.prisma8, p.id, { title: 'todo-1b', sortOrder: 1 });

      const page = await repo.findByProject(p.id, s.owner);

      expect(titles(page)).toEqual([
        'todo-1',
        'todo-1b',
        'todo-2',
        'doing',
        'done',
      ]);
      expect(page).toMatchObject({ total: 5, nextCursor: null });
    });

    it('pages with an id cursor, defaulting to 20, total ignores the cursor', async () => {
      const p = await seedProject(db.prisma8, s.owner);
      const ids: number[] = [];
      for (let i = 0; i < 21; i++)
        ids.push((await seedTask(db.prisma8, p.id)).id);

      const page1 = await repo.findByProject(p.id, s.owner);
      expect(page1.items).toHaveLength(20);
      expect(page1).toMatchObject({ total: 21, nextCursor: ids[19] });

      const page2 = await repo.findByProject(p.id, s.owner, {
        cursor: page1.nextCursor!,
      });
      expect(page2.items.map((t) => t.id)).toEqual([ids[20]]);
      expect(page2).toMatchObject({ total: 21, nextCursor: null });
    });

    it('pages through every task exactly once, in sort order', async () => {
      const p = await seedProject(db.prisma8, s.owner);
      const tasks = [
        await seedTask(db.prisma8, p.id, { status: 'DONE' }),
        await seedTask(db.prisma8, p.id, { sortOrder: 2 }),
        await seedTask(db.prisma8, p.id, { status: 'IN_PROGRESS' }),
        await seedTask(db.prisma8, p.id, { sortOrder: 1 }),
        await seedTask(db.prisma8, p.id, { sortOrder: 1 }),
        await seedTask(db.prisma8, p.id, { status: 'PAID' }),
      ];
      const expected = [
        tasks[3],
        tasks[4],
        tasks[1],
        tasks[2],
        tasks[0],
        tasks[5],
      ].map((t) => t.id);

      const seen: number[] = [];
      let cursor: number | undefined;
      for (let i = 0; i < 10; i++) {
        const page = await repo.findByProject(p.id, s.owner, {
          limit: 2,
          cursor,
        });
        seen.push(...page.items.map((t) => t.id));
        if (page.nextCursor === null) break;
        cursor = page.nextCursor;
      }
      expect(seen).toEqual(expected);
    });

    it('has no next cursor when the page holds exactly the limit', async () => {
      await expect(
        repo.findByProject(s.project, s.owner, { limit: 2 }),
      ).resolves.toMatchObject({
        nextCursor: null,
        total: 2,
      });
    });

    it('returns the tasks after an unknown cursor id', async () => {
      await expect(
        repo.findByProject(s.project, s.owner, { cursor: 999999 }),
      ).resolves.toMatchObject({
        items: [],
        total: 2,
      });
    });

    it('searches titles case-insensitively', async () => {
      const p = await seedProject(db.prisma8, s.owner);
      await seedTask(db.prisma8, p.id, { title: 'Translate Chapter 1' });
      await seedTask(db.prisma8, p.id, { title: 'proofread chapter 2' });
      await seedTask(db.prisma8, p.id, { title: 'Invoice' });

      const page = await repo.findByProject(
        p.id,
        s.owner,
        undefined,
        'CHAPTER',
      );

      expect(titles(page).sort()).toEqual([
        'Translate Chapter 1',
        'proofread chapter 2',
      ]);
      expect(page.total).toBe(2);
    });

    it('is only for the project owner', async () => {
      await expect(
        repo.findByProject(s.project, s.owner),
      ).resolves.toMatchObject({ total: 2 });
      await expect(
        repo.findByProject(s.project, s.stranger),
      ).resolves.toMatchObject({ items: [], total: 0 });
    });
  });

  describe('create', () => {
    it("refuses a project the caller doesn't own", async () => {
      await expect(
        repo.create({ projectId: s.project, title: 'Intruder' }, s.stranger),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        db.prisma8.orm.public.Task.where({ title: 'Intruder' }).all(),
      ).resolves.toEqual([]);
    });

    it('defaults the status to TODO and stores the given fields', async () => {
      const due = new Date('2026-11-15T00:00:00.000Z');
      await expect(
        repo.create(
          {
            projectId: s.project,
            title: 'New',
            description: 'd',
            dueDate: due,
            wordCount: 800,
          },
          s.owner,
        ),
      ).resolves.toMatchObject({
        projectId: s.project,
        title: 'New',
        description: 'd',
        status: 'TODO',
        dueDate: due,
        wordCount: 800,
      });
    });

    it('keeps an explicit status and stores startDate / recurring / reminderOffset', async () => {
      const task = await repo.create(
        {
          projectId: s.project,
          title: 'X',
          status: TaskStatus.IN_PROGRESS,
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          recurring: 'WEEKLY',
          reminderOffset: '1d',
        },
        s.owner,
      );
      expect(task.status).toBe('IN_PROGRESS');
      const row = await db.prisma8.orm.public.Task.first({ id: task.id });
      expect(row).toMatchObject({ recurring: 'WEEKLY', reminderOffset: '1d' });
      expect(fromDb(row!.startDate)).toEqual(
        new Date('2026-11-01T00:00:00.000Z'),
      );
    });
  });

  describe('update', () => {
    it('lets the owner change fields, moving updatedAt', async () => {
      const before = await repo.findById(s.task, s.owner);
      await new Promise((r) => setTimeout(r, 5));
      const updated = await repo.update(s.task, s.owner, {
        id: s.task,
        status: TaskStatus.DONE,
        sortOrder: 3,
        wordCount: null,
      });
      expect(updated).toMatchObject({
        status: 'DONE',
        sortOrder: 3,
        wordCount: null,
        title: before.title,
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        before.updatedAt.getTime(),
      );
      await expect(
        repo.update(s.task, s.owner, { id: s.task, title: 'Renamed' }),
      ).resolves.toMatchObject({ title: 'Renamed' });
    });

    it('stores startDate / recurring / reminderOffset', async () => {
      const start = new Date('2026-11-01T00:00:00.000Z');
      await repo.update(s.task, s.owner, {
        id: s.task,
        startDate: start,
        recurring: 'WEEKLY',
        reminderOffset: '1d',
      });
      const row = await db.prisma8.orm.public.Task.first({ id: s.task });
      expect(row).toMatchObject({ recurring: 'WEEKLY', reminderOffset: '1d' });
    });

    it('throws NotFound for a stranger', async () => {
      await expect(
        repo.update(s.task, s.stranger, { id: s.task, title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('returns the deleted task, not another of the owner', async () => {
      await expect(repo.delete(s.otherTask, s.owner)).resolves.toMatchObject({
        id: s.otherTask,
      });
      await expect(repo.findById(s.task, s.owner)).resolves.toMatchObject({
        id: s.task,
      });
    });

    it('lets only the project owner delete, returning the task', async () => {
      await expect(repo.delete(s.task, s.stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.delete(s.task, s.owner)).resolves.toMatchObject({
        id: s.task,
      });
      await expect(repo.findById(s.task, s.owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('checklist titles', () => {
    const checklist = async () =>
      (await repo.findById(s.task, s.owner)).checklistTitles;

    it('appends a title once', async () => {
      await repo.addChecklistTitle(s.task, 'Sections');
      await repo.addChecklistTitle(s.task, 'Review');
      await repo.addChecklistTitle(s.task, 'Sections');
      await expect(checklist()).resolves.toEqual(['Sections', 'Review']);
    });

    it('throws NotFound when adding to an unknown task', async () => {
      await expect(repo.addChecklistTitle(999999, 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('renames in place and removes, ignoring unknown tasks', async () => {
      await repo.addChecklistTitle(s.task, 'A');
      await repo.addChecklistTitle(s.task, 'B');
      await repo.renameChecklistTitle(s.task, 'A', 'A2');
      await expect(checklist()).resolves.toEqual(['A2', 'B']);
      await repo.removeChecklistTitle(s.task, 'B');
      await expect(checklist()).resolves.toEqual(['A2']);
      await expect(
        repo.renameChecklistTitle(999999, 'A', 'B'),
      ).resolves.toBeUndefined();
      await expect(
        repo.removeChecklistTitle(999999, 'A'),
      ).resolves.toBeUndefined();
    });
  });
});
