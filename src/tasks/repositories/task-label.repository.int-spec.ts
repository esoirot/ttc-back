import { NotFoundException } from '@nestjs/common';
import { at } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { PrismaTaskLabelRepository } from './prisma-task-label.repository';
import { Prisma8TaskLabelRepository } from './prisma8-task-label.repository';
import { TaskLabelRepository } from './task-label.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  [
    'prisma7',
    (): TaskLabelRepository => new PrismaTaskLabelRepository(db.prisma7),
  ],
  [
    'prisma8',
    (): TaskLabelRepository => new Prisma8TaskLabelRepository(db.prisma8),
  ],
])('TaskLabelRepository (%s)', (_impl, make) => {
  let repo: TaskLabelRepository;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;

  const label = (taskId: number, name: string, minute = 0) =>
    db.prisma8.orm.public.TaskLabel.create({
      taskId,
      name,
      createdAt: at(minute),
    });

  // Created first, so a write that loses its filter lands here.
  let decoy: Awaited<ReturnType<typeof label>>;

  beforeEach(async () => {
    repo = make();
    s = await seedTaskAccess(db.prisma8);
    decoy = await label(s.otherTask, 'decoy');
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.TaskLabel.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('findByTaskIds', () => {
    it('returns nothing for no ids', async () => {
      await expect(repo.findByTaskIds([], s.owner)).resolves.toEqual([]);
    });

    it('returns labels of the requested tasks, oldest first', async () => {
      await label(s.task, 'second', 2);
      await label(s.task, 'first', 1);
      await label(s.otherTask, 'not requested', 0);

      const labels = await repo.findByTaskIds([s.task], s.owner);

      expect(labels.map((l) => l.name)).toEqual(['first', 'second']);
      expect(labels[0]).toEqual({
        id: anyNumber,
        taskId: s.task,
        name: 'first',
        color: '#6B7280',
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
      });
    });

    it('is visible to the assignee but not to a stranger', async () => {
      await label(s.task, 'x');
      await expect(
        repo.findByTaskIds([s.task], s.assignee),
      ).resolves.toHaveLength(1);
      await expect(repo.findByTaskIds([s.task], s.stranger)).resolves.toEqual(
        [],
      );
    });
  });

  describe('create', () => {
    it('defaults the color to grey', async () => {
      await expect(
        repo.create({ taskId: s.task, name: 'bug' }),
      ).resolves.toMatchObject({
        taskId: s.task,
        name: 'bug',
        color: '#6B7280',
      });
    });

    it('keeps an explicit color', async () => {
      await expect(
        repo.create({ taskId: s.task, name: 'ok', color: '#00FF00' }),
      ).resolves.toMatchObject({ color: '#00FF00' });
    });
  });

  describe('delete', () => {
    it.each([['owner'], ['assignee']] as const)(
      'lets the %s delete and returns the label',
      async (who) => {
        const { id } = await label(s.task, 'gone');
        await expect(repo.delete(id, s[who])).resolves.toMatchObject({
          id,
          name: 'gone',
        });
        await expect(repo.findByTaskIds([s.task], s.owner)).resolves.toEqual(
          [],
        );
      },
    );

    it('throws NotFound for a stranger and keeps the label', async () => {
      const { id } = await label(s.task, 'keep');
      await expect(repo.delete(id, s.stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(repo.findByTaskIds([s.task], s.owner)).resolves.toHaveLength(
        1,
      );
    });
  });
});
