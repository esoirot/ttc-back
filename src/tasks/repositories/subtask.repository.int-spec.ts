import { NotFoundException } from '@nestjs/common';
import { at, seedProject, seedTask } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { Prisma8SubtaskRepository } from './prisma8-subtask.repository';
import { SubtaskRepository } from './subtask.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  [
    'prisma8',
    (): SubtaskRepository => new Prisma8SubtaskRepository(db.prisma8),
  ],
])('SubtaskRepository (%s)', (_impl, make) => {
  let repo: SubtaskRepository;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;

  const item = (
    taskId: number,
    title: string,
    data: {
      checklistTitle?: string;
      wordCount?: number;
      countInTotal?: boolean;
      minute?: number;
    } = {},
  ) =>
    db.prisma8.orm.public.Subtask.create({
      taskId,
      title,
      checklistTitle: data.checklistTitle ?? null,
      wordCount: data.wordCount ?? null,
      countInTotal: data.countInTotal,
      createdAt: at(data.minute ?? 0),
      updatedAt: at(data.minute ?? 0),
    });

  // Created first, on the other task: a write that loses its filter lands here.
  let decoy: Awaited<ReturnType<typeof item>>;
  const notDecoy = <T extends { id: number }>(rows: T[]) =>
    rows.filter((r) => r.id !== decoy.id);

  beforeEach(async () => {
    repo = make();
    s = await seedTaskAccess(db.prisma8);
    decoy = await item(s.otherTask, 'decoy');
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.Subtask.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('findByTaskIds / findById', () => {
    it('returns items of the requested tasks, oldest first', async () => {
      await item(s.task, 'second', { minute: 2 });
      await item(s.task, 'first', {
        minute: 1,
        checklistTitle: 'Sections',
        wordCount: 300,
      });
      await item(s.otherTask, 'not requested');

      const rows = await repo.findByTaskIds([s.task], s.owner);

      expect(rows.map((r) => r.title)).toEqual(['first', 'second']);
      expect(rows[0]).toEqual({
        id: anyNumber,
        taskId: s.task,
        checklistTitle: 'Sections',
        title: 'first',
        done: false,
        dueDate: null,
        wordCount: 300,
        countInTotal: true,
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
        updatedAt: new Date('2026-01-01T00:01:00.000Z'),
      });
    });

    it('is visible to the owner, NotFound / empty for a stranger', async () => {
      const { id } = await item(s.task, 'x');
      await expect(repo.findByTaskIds([s.task], s.owner)).resolves.toHaveLength(
        1,
      );
      await expect(repo.findByTaskIds([s.task], s.stranger)).resolves.toEqual(
        [],
      );
      await expect(repo.findById(id, s.owner)).resolves.toMatchObject({
        id,
      });
      await expect(repo.findById(id, s.stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('stores optional fields only when given', async () => {
      const due = new Date('2026-11-01T00:00:00.000Z');
      await expect(
        repo.create({
          taskId: s.task,
          title: 'full',
          checklistTitle: 'C',
          dueDate: due,
          wordCount: 120,
          countInTotal: false,
        }),
      ).resolves.toMatchObject({
        checklistTitle: 'C',
        dueDate: due,
        wordCount: 120,
        countInTotal: false,
        done: false,
      });
      await expect(
        repo.create({ taskId: s.task, title: 'bare' }),
      ).resolves.toMatchObject({
        checklistTitle: null,
        dueDate: null,
        wordCount: null,
        countInTotal: true,
      });
    });
  });

  describe('update', () => {
    it('changes the given fields, can clear wordCount, moves updatedAt', async () => {
      const { id } = await item(s.task, 'old', { wordCount: 50, minute: 1 });
      const updated = await repo.update(id, s.owner, {
        id,
        title: 'new',
        done: true,
        wordCount: null,
        countInTotal: false,
      });
      expect(updated).toMatchObject({
        title: 'new',
        done: true,
        wordCount: null,
        countInTotal: false,
      });
      await expect(
        repo.update(id, s.owner, { id, title: 'again' }),
      ).resolves.toMatchObject({ countInTotal: false });
      await expect(
        repo.update(id, s.owner, { id, countInTotal: true }),
      ).resolves.toMatchObject({ countInTotal: true });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        updated.createdAt.getTime(),
      );
    });

    it('changes the due date', async () => {
      const { id } = await item(s.task, 'dated');
      const due = new Date('2026-12-24T00:00:00.000Z');
      await expect(
        repo.update(id, s.owner, { id, dueDate: due }),
      ).resolves.toMatchObject({ dueDate: due });
    });

    it('throws NotFound for a stranger', async () => {
      const { id } = await item(s.task, 'keep');
      await expect(
        repo.update(id, s.stranger, { id, title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes for the owner and returns the item, NotFound for a stranger', async () => {
      const gone = await item(s.task, 'gone');
      const kept = await item(s.task, 'kept');
      await expect(repo.delete(kept.id, s.stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.delete(gone.id, s.owner)).resolves.toMatchObject({
        id: gone.id,
      });
      await expect(repo.findByTaskIds([s.task], s.owner)).resolves.toEqual([
        expect.objectContaining({ id: kept.id }),
      ]);
    });
  });

  describe('checklists', () => {
    it('renames a checklist on one task only and returns the count', async () => {
      await item(s.task, 'a', { checklistTitle: 'Old' });
      await item(s.task, 'b', { checklistTitle: 'Old' });
      await item(s.task, 'c', { checklistTitle: 'Other' });
      await item(s.otherTask, 'd', { checklistTitle: 'Old' });

      await expect(repo.renameChecklist(s.task, 'Old', 'New')).resolves.toBe(2);
      const titles = notDecoy(
        await repo.findByTaskIds([s.task, s.otherTask], s.owner),
      ).map((r) => [r.title, r.checklistTitle]);
      expect(titles.sort()).toEqual([
        ['a', 'New'],
        ['b', 'New'],
        ['c', 'Other'],
        ['d', 'Old'],
      ]);
    });

    it('deletes a checklist on one task only and returns the count', async () => {
      await item(s.task, 'a', { checklistTitle: 'Gone' });
      await item(s.task, 'b', { checklistTitle: 'Kept' });
      await item(s.otherTask, 'c', { checklistTitle: 'Gone' });

      await expect(repo.deleteByChecklist(s.task, 'Gone')).resolves.toBe(1);
      const left = notDecoy(
        await repo.findByTaskIds([s.task, s.otherTask], s.owner),
      ).map((r) => r.title);
      expect(left.sort()).toEqual(['b', 'c']);
    });
  });

  describe('sumWordsByProjectIds', () => {
    it("adds tasks' own words and their counted items' words per project, for the owner only", async () => {
      await db.prisma8.orm.public.Task.where({ id: s.task }).update({
        wordCount: 1000,
      });
      await item(s.task, 'i1', { wordCount: 200 });
      await item(s.otherTask, 'i2', { wordCount: 50 });
      await item(s.otherTask, 'no words');
      await item(s.otherTask, 'not counted', {
        wordCount: 7000,
        countInTotal: false,
      });
      const empty = await seedProject(db.prisma8, s.owner);
      await seedTask(db.prisma8, empty.id);

      const sums = await repo.sumWordsByProjectIds(
        [s.project, empty.id],
        s.owner,
      );

      expect([...sums]).toEqual([[s.project, 1250]]);
      await expect(
        repo.sumWordsByProjectIds([s.project], s.stranger),
      ).resolves.toEqual(new Map());
    });
  });
});
