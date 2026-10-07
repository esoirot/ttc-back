import { NotFoundException } from '@nestjs/common';
import { seedProject, seedTask, seedUser } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { fromDb } from '../../prisma8/timestamp';
import { TaskStatus } from '../entities/task.entity';
import { PrismaTaskRepository } from './prisma-task.repository';
import { TaskRepository } from './task.repository';

const db = useTestDb();

describe.each([
  ['prisma7', (): TaskRepository => new PrismaTaskRepository(db.prisma7)],
])('TaskRepository (%s)', (_impl, make) => {
  let repo: TaskRepository;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;

  const titles = (page: { items: { title: string }[] }) =>
    page.items.map((t) => t.title);

  beforeEach(async () => {
    repo = make();
    s = await seedTaskAccess(db.prisma8);
  });

  describe('findById', () => {
    it('returns the task to the owner and the assignee', async () => {
      const task = await repo.findById(s.task, s.assignee);
      expect(task).toMatchObject({
        id: s.task,
        projectId: s.project,
        assigneeId: s.assignee,
        status: 'TODO',
        description: null,
        dueDate: null,
        wordCount: null,
        sortOrder: 0,
        checklistTitles: [],
      });
      expect(task.createdAt).toBeInstanceOf(Date);
      await expect(repo.findById(s.task, s.owner)).resolves.toMatchObject({
        id: s.task,
      });
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

    it('is only for the project owner, not the assignee', async () => {
      await expect(
        repo.findByProject(s.project, s.owner),
      ).resolves.toMatchObject({ total: 2 });
      await expect(
        repo.findByProject(s.project, s.assignee),
      ).resolves.toMatchObject({ items: [], total: 0 });
    });
  });

  describe('findByAssignee', () => {
    it("returns the assignee's tasks across projects, defaulting to 50 per page", async () => {
      const other = await seedUser(db.prisma8);
      const p2 = await seedProject(db.prisma8, other.id);
      await seedTask(db.prisma8, p2.id, {
        title: 'elsewhere',
        assigneeId: s.assignee,
        status: 'DONE',
      });

      const page = await repo.findByAssignee(s.assignee);

      expect(page.items.map((t) => t.status)).toEqual(['TODO', 'DONE']);
      expect(page).toMatchObject({ total: 2, nextCursor: null });
    });

    it('pages with an id cursor', async () => {
      const ids = [s.task];
      for (let i = 0; i < 2; i++)
        ids.push(
          (await seedTask(db.prisma8, s.project, { assigneeId: s.assignee }))
            .id,
        );

      const page1 = await repo.findByAssignee(s.assignee, { limit: 2 });
      expect(page1).toMatchObject({ total: 3, nextCursor: ids[1] });
      const page2 = await repo.findByAssignee(s.assignee, {
        limit: 2,
        cursor: ids[1],
      });
      expect(page2.items.map((t) => t.id)).toEqual([ids[2]]);
    });
  });

  describe('findByAssignee paging', () => {
    it('pages through every assigned task exactly once, in sort order', async () => {
      const done = await seedTask(db.prisma8, s.project, {
        assigneeId: s.assignee,
        status: 'DONE',
      });
      const later = await seedTask(db.prisma8, s.project, {
        assigneeId: s.assignee,
        sortOrder: 5,
      });
      const expected = [s.task, later.id, done.id];

      const seen: number[] = [];
      let cursor: number | undefined;
      for (let i = 0; i < 10; i++) {
        const page = await repo.findByAssignee(s.assignee, {
          limit: 1,
          cursor,
        });
        seen.push(...page.items.map((t) => t.id));
        if (page.nextCursor === null) break;
        cursor = page.nextCursor;
      }
      expect(seen).toEqual(expected);
    });
  });

  describe('create', () => {
    it('defaults the status to TODO and stores the given fields', async () => {
      const due = new Date('2026-11-15T00:00:00.000Z');
      await expect(
        repo.create({
          projectId: s.project,
          title: 'New',
          description: 'd',
          assigneeId: s.assignee,
          dueDate: due,
          wordCount: 800,
        }),
      ).resolves.toMatchObject({
        projectId: s.project,
        title: 'New',
        description: 'd',
        assigneeId: s.assignee,
        status: 'TODO',
        dueDate: due,
        wordCount: 800,
      });
    });

    it('keeps an explicit status and stores startDate / recurring / reminderOffset', async () => {
      const task = await repo.create({
        projectId: s.project,
        title: 'X',
        status: TaskStatus.IN_PROGRESS,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        recurring: 'WEEKLY',
        reminderOffset: '1d',
      });
      expect(task.status).toBe('IN_PROGRESS');
      const row = await db.prisma8.orm.public.Task.first({ id: task.id });
      expect(row).toMatchObject({ recurring: 'WEEKLY', reminderOffset: '1d' });
      expect(fromDb(row!.startDate)).toEqual(
        new Date('2026-11-01T00:00:00.000Z'),
      );
    });
  });

  describe('update', () => {
    it('lets owner and assignee change fields, moving updatedAt', async () => {
      const before = await repo.findById(s.task, s.owner);
      await new Promise((r) => setTimeout(r, 5));
      const updated = await repo.update(s.task, s.assignee, {
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
    it('lets only the project owner delete, returning the task', async () => {
      await expect(repo.delete(s.task, s.assignee)).rejects.toBeInstanceOf(
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
