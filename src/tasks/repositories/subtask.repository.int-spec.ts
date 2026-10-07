import { NotFoundException } from '@nestjs/common';
import { at, seedProject, seedTask } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { PrismaSubtaskRepository } from './prisma-subtask.repository';
import { SubtaskRepository } from './subtask.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  ['prisma7', (): SubtaskRepository => new PrismaSubtaskRepository(db.prisma7)],
])('SubtaskRepository (%s)', (_impl, make) => {
  let repo: SubtaskRepository;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;

  const item = (
    taskId: number,
    title: string,
    data: { checklistTitle?: string; wordCount?: number; minute?: number } = {},
  ) =>
    db.prisma8.orm.public.Subtask.create({
      taskId,
      title,
      checklistTitle: data.checklistTitle ?? null,
      wordCount: data.wordCount ?? null,
      createdAt: at(data.minute ?? 0),
      updatedAt: at(data.minute ?? 0),
    });

  beforeEach(async () => {
    repo = make();
    s = await seedTaskAccess(db.prisma8);
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
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
        updatedAt: new Date('2026-01-01T00:01:00.000Z'),
      });
    });

    it('is visible to the owner and assignee, NotFound / empty for a stranger', async () => {
      const { id } = await item(s.task, 'x');
      await expect(
        repo.findByTaskIds([s.task], s.assignee),
      ).resolves.toHaveLength(1);
      await expect(repo.findByTaskIds([s.task], s.stranger)).resolves.toEqual(
        [],
      );
      await expect(repo.findById(id, s.assignee)).resolves.toMatchObject({
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
        }),
      ).resolves.toMatchObject({
        checklistTitle: 'C',
        dueDate: due,
        wordCount: 120,
        done: false,
      });
      await expect(
        repo.create({ taskId: s.task, title: 'bare' }),
      ).resolves.toMatchObject({
        checklistTitle: null,
        dueDate: null,
        wordCount: null,
      });
    });
  });

  describe('update', () => {
    it('changes the given fields, can clear wordCount, moves updatedAt', async () => {
      const { id } = await item(s.task, 'old', { wordCount: 50, minute: 1 });
      const updated = await repo.update(id, s.assignee, {
        id,
        title: 'new',
        done: true,
        wordCount: null,
      });
      expect(updated).toMatchObject({
        title: 'new',
        done: true,
        wordCount: null,
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        updated.createdAt.getTime(),
      );
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
      const titles = (
        await repo.findByTaskIds([s.task, s.otherTask], s.owner)
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
      const left = (
        await repo.findByTaskIds([s.task, s.otherTask], s.owner)
      ).map((r) => r.title);
      expect(left.sort()).toEqual(['b', 'c']);
    });
  });

  describe('sumWordsByProjectIds', () => {
    it("adds tasks' own words and their items' words per project, for the owner only", async () => {
      await db.prisma8.orm.public.Task.where({ id: s.task }).update({
        wordCount: 1000,
      });
      await item(s.task, 'i1', { wordCount: 200 });
      await item(s.otherTask, 'i2', { wordCount: 50 });
      await item(s.otherTask, 'no words');
      const empty = await seedProject(db.prisma8, s.owner);
      await seedTask(db.prisma8, empty.id);

      const sums = await repo.sumWordsByProjectIds(
        [s.project, empty.id],
        s.owner,
      );

      expect([...sums]).toEqual([[s.project, 1250]]);
      await expect(
        repo.sumWordsByProjectIds([s.project], s.assignee),
      ).resolves.toEqual(new Map());
    });
  });
});
