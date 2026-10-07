import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { at } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { CommentRepository } from './comment.repository';
import { PrismaCommentRepository } from './prisma-comment.repository';
import { Prisma8CommentRepository } from './prisma8-comment.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  ['prisma7', (): CommentRepository => new PrismaCommentRepository(db.prisma7)],
  [
    'prisma8',
    (): CommentRepository => new Prisma8CommentRepository(db.prisma8),
  ],
])('CommentRepository (%s)', (_impl, make) => {
  let repo: CommentRepository;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;

  const comment = (
    taskId: number,
    authorId: number,
    body: string,
    minute = 0,
  ) =>
    db.prisma8.orm.public.TaskComment.create({
      taskId,
      authorId,
      body,
      createdAt: at(minute),
      updatedAt: at(minute),
    });

  // Created first, so a write that loses its filter lands here.
  let decoy: Awaited<ReturnType<typeof comment>>;

  beforeEach(async () => {
    repo = make();
    s = await seedTaskAccess(db.prisma8);
    decoy = await comment(s.otherTask, s.assignee, 'decoy');
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.TaskComment.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('findByTaskIds', () => {
    it('returns nothing for no ids', async () => {
      await expect(repo.findByTaskIds([], s.owner)).resolves.toEqual([]);
    });

    it('returns comments of the requested tasks, oldest first', async () => {
      await comment(s.task, s.owner, 'second', 2);
      await comment(s.task, s.assignee, 'first', 1);
      await comment(s.otherTask, s.owner, 'not requested');

      const rows = await repo.findByTaskIds([s.task], s.owner);

      expect(rows.map((c) => c.body)).toEqual(['first', 'second']);
      expect(rows[0]).toEqual({
        id: anyNumber,
        taskId: s.task,
        authorId: s.assignee,
        body: 'first',
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
        updatedAt: new Date('2026-01-01T00:01:00.000Z'),
      });
    });

    it('is visible to the assignee but not to a stranger', async () => {
      await comment(s.task, s.owner, 'x');
      await expect(
        repo.findByTaskIds([s.task], s.assignee),
      ).resolves.toHaveLength(1);
      await expect(repo.findByTaskIds([s.task], s.stranger)).resolves.toEqual(
        [],
      );
    });
  });

  describe('create', () => {
    it('stores the comment for its author', async () => {
      await expect(
        repo.create({ taskId: s.task, body: 'hello' }, s.assignee),
      ).resolves.toMatchObject({
        taskId: s.task,
        authorId: s.assignee,
        body: 'hello',
      });
    });
  });

  describe('update', () => {
    it('lets the author edit the body and moves updatedAt forward', async () => {
      const { id } = await comment(s.task, s.owner, 'draft', 1);
      const updated = await repo.update(id, { id, body: 'final' }, s.owner);
      expect(updated).toMatchObject({
        id,
        body: 'final',
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
      });
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        updated.createdAt.getTime(),
      );
    });

    it('forbids anyone but the author', async () => {
      const { id } = await comment(s.task, s.owner, 'mine');
      await expect(
        repo.update(id, { id, body: 'x' }, s.assignee),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound for an unknown comment', async () => {
      await expect(
        repo.update(999999, { id: 999999, body: 'x' }, s.owner),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('lets the author delete and returns the comment', async () => {
      const { id } = await comment(s.task, s.owner, 'bye');
      await expect(repo.delete(id, s.owner)).resolves.toMatchObject({
        id,
        body: 'bye',
      });
      await expect(repo.findByTaskIds([s.task], s.owner)).resolves.toEqual([]);
    });

    it('forbids anyone but the author and keeps the comment', async () => {
      const { id } = await comment(s.task, s.owner, 'keep');
      await expect(repo.delete(id, s.assignee)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(repo.findByTaskIds([s.task], s.owner)).resolves.toHaveLength(
        1,
      );
    });

    it('throws NotFound for an unknown comment', async () => {
      await expect(repo.delete(999999, s.owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
