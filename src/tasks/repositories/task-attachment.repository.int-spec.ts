import { at } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { PrismaTaskAttachmentRepository } from './prisma-task-attachment.repository';
import { Prisma8TaskAttachmentRepository } from './prisma8-task-attachment.repository';
import { TaskAttachmentRepository } from './task-attachment.repository';
import { anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();

describe.each([
  [
    'prisma7',
    (): TaskAttachmentRepository =>
      new PrismaTaskAttachmentRepository(db.prisma7),
  ],
  [
    'prisma8',
    (): TaskAttachmentRepository =>
      new Prisma8TaskAttachmentRepository(db.prisma8),
  ],
])('TaskAttachmentRepository (%s)', (_impl, make) => {
  let repo: TaskAttachmentRepository;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;

  const attachment = (taskId: number, url: string, minute = 0) =>
    db.prisma8.orm.public.TaskAttachment.create({
      taskId,
      _type: 'LINK',
      url,
      createdAt: at(minute),
    });

  // Created first, so a write that loses its filter lands here.
  let decoy: Awaited<ReturnType<typeof attachment>>;

  beforeEach(async () => {
    repo = make();
    s = await seedTaskAccess(db.prisma8);
    decoy = await attachment(s.otherTask, 'https://decoy');
  });

  afterEach(async () => {
    await expect(
      db.prisma8.orm.public.TaskAttachment.first({ id: decoy.id }),
    ).resolves.toEqual(decoy);
  });

  describe('findByTaskIds', () => {
    it('returns nothing for no ids', async () => {
      await expect(repo.findByTaskIds([], s.owner)).resolves.toEqual([]);
    });

    it('returns attachments of the requested tasks, oldest first', async () => {
      await attachment(s.task, 'https://b', 2);
      await attachment(s.task, 'https://a', 1);
      await attachment(s.otherTask, 'https://other');

      const rows = await repo.findByTaskIds([s.task], s.owner);

      expect(rows.map((r) => r.url)).toEqual(['https://a', 'https://b']);
      expect(rows[0]).toEqual({
        id: anyNumber,
        taskId: s.task,
        type: 'LINK',
        fileName: null,
        url: 'https://a',
        displayText: null,
        storageKey: null,
        storageDriver: null,
        createdAt: new Date('2026-01-01T00:01:00.000Z'),
      });
    });

    it('is visible to the assignee but not to a stranger', async () => {
      await attachment(s.task, 'https://x');
      await expect(
        repo.findByTaskIds([s.task], s.assignee),
      ).resolves.toHaveLength(1);
      await expect(repo.findByTaskIds([s.task], s.stranger)).resolves.toEqual(
        [],
      );
    });
  });

  describe('findById', () => {
    it('returns the attachment to the owner and assignee, null to a stranger', async () => {
      const { id } = await attachment(s.task, 'https://x');
      await expect(repo.findById(id, s.owner)).resolves.toMatchObject({ id });
      await expect(repo.findById(id, s.assignee)).resolves.toMatchObject({
        id,
      });
      await expect(repo.findById(id, s.stranger)).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('stores a file attachment with every field', async () => {
      await expect(
        repo.create({
          taskId: s.task,
          type: 'FILE',
          fileName: 'brief.pdf',
          url: '/files/brief.pdf',
          displayText: 'Brief',
          storageKey: 'k/brief.pdf',
          storageDriver: 'local',
        }),
      ).resolves.toMatchObject({
        taskId: s.task,
        type: 'FILE',
        fileName: 'brief.pdf',
        url: '/files/brief.pdf',
        displayText: 'Brief',
        storageKey: 'k/brief.pdf',
        storageDriver: 'local',
      });
    });

    it('stores null for omitted optional fields', async () => {
      await expect(
        repo.create({ taskId: s.task, type: 'LINK', url: 'https://x' }),
      ).resolves.toMatchObject({
        fileName: null,
        displayText: null,
        storageKey: null,
        storageDriver: null,
      });
    });
  });

  describe('update', () => {
    it('changes only the given fields', async () => {
      const { id } = await attachment(s.task, 'https://old');
      await expect(
        repo.update(id, { displayText: 'Label' }, s.owner),
      ).resolves.toMatchObject({
        url: 'https://old',
        displayText: 'Label',
      });
      await expect(
        repo.update(id, { url: 'https://new', displayText: null }, s.assignee),
      ).resolves.toMatchObject({
        url: 'https://new',
        displayText: null,
      });
    });

    it('returns null for a stranger and leaves the row unchanged', async () => {
      const { id } = await attachment(s.task, 'https://keep');
      await expect(
        repo.update(id, { url: 'https://hacked' }, s.stranger),
      ).resolves.toBeNull();
      await expect(repo.findById(id, s.owner)).resolves.toMatchObject({
        url: 'https://keep',
      });
    });
  });

  describe('delete', () => {
    it('deletes for the owner and returns the row', async () => {
      const { id } = await attachment(s.task, 'https://gone');
      await expect(repo.delete(id, s.owner)).resolves.toMatchObject({
        id,
        url: 'https://gone',
      });
      await expect(repo.findById(id, s.owner)).resolves.toBeNull();
    });

    it('returns null for a stranger and keeps the row', async () => {
      const { id } = await attachment(s.task, 'https://keep');
      await expect(repo.delete(id, s.stranger)).resolves.toBeNull();
      await expect(repo.findById(id, s.owner)).resolves.not.toBeNull();
    });
  });
});
