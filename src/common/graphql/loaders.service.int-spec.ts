import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma8Module } from '../../prisma8/prisma8.module';
import { seedClient, seedTimeEntry } from '../../prisma8/testing/seed';
import { seedTaskAccess } from '../../prisma8/testing/task-access';
import { useTestDb } from '../../prisma8/testing/test-db';
import { toDb } from '../../prisma8/timestamp';
import { GqlLoaders, LoadersService } from './loaders.service';
import { GraphqlLoadersModule } from './loaders.module';

const db = useTestDb();

// Every nested GraphQL field (Task.subtasks, Client.statusHistory,
// Project.totalTimeSeconds...) resolves through these loaders, with the
// requesting user's id. Whoever can reach a parent object, its children only
// come back for users entitled to them.
describe('nested field loaders: who sees what', () => {
  let module: TestingModule;
  let service: LoadersService;
  let s: Awaited<ReturnType<typeof seedTaskAccess>>;
  let ids: { task: number; project: number; entry: number; client: number };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        Prisma8Module,
        GraphqlLoadersModule,
      ],
    }).compile();
    service = module.get(LoadersService);
  });

  afterAll(() => module.close());

  beforeEach(async () => {
    const o = db.prisma8.orm.public;
    const now = toDb(new Date());
    s = await seedTaskAccess(db.prisma8);
    await o.Subtask.create({
      taskId: s.task,
      title: 'Section',
      wordCount: 300,
      updatedAt: now,
    });
    await o.TaskComment.create({
      taskId: s.task,
      authorId: s.owner,
      body: 'note',
      updatedAt: now,
    });
    await o.TaskLabel.create({ taskId: s.task, name: 'urgent' });
    await o.TaskAttachment.create({
      taskId: s.task,
      _type: 'LINK',
      url: 'https://example.com',
    });
    await o.TaskActivity.create({
      taskId: s.task,
      userId: s.owner,
      _type: 'CREATED',
    });
    const entry = await seedTimeEntry(db.prisma8, s.owner, {
      projectId: s.project,
      taskId: s.task,
      durationSeconds: 600,
      wordsProcessed: 200,
      endTime: now,
    });
    await o.TaskActivity.create({
      timeEntryId: entry.id,
      userId: s.owner,
      _type: 'STARTED',
    });
    const client = await seedClient(db.prisma8, s.owner);
    await o.ClientStatusHistory.create({
      clientId: client.id,
      userId: s.owner,
      _type: 'STATUS_CHANGE',
    });
    ids = {
      task: s.task,
      project: s.project,
      entry: entry.id,
      client: client.id,
    };
  });

  const read = async (userId: number) => {
    const l: GqlLoaders = service.createLoaders(() => userId);
    return {
      subtasks: (await l.subtasksByTask.load(ids.task)).length,
      comments: (await l.commentsByTask.load(ids.task)).length,
      labels: (await l.labelsByTask.load(ids.task)).length,
      attachments: (await l.attachmentsByTask.load(ids.task)).length,
      taskActivities: (await l.activitiesByTask.load(ids.task)).length,
      taskSeconds: await l.totalSecondsByTask.load(ids.task),
      taskWords: await l.totalWordsProcessedByTask.load(ids.task),
      entryActivities: (await l.activitiesByTimeEntry.load(ids.entry)).length,
      projectSeconds: await l.totalSecondsByProject.load(ids.project),
      projectWords: await l.totalWordsProcessedByProject.load(ids.project),
      projectTaskWords: await l.totalTaskWordsByProject.load(ids.project),
      statusHistory: (await l.statusHistoryByClient.load(ids.client)).length,
    };
  };

  it('gives the owner every nested field', async () => {
    await expect(read(s.owner)).resolves.toEqual({
      subtasks: 1,
      comments: 1,
      labels: 1,
      attachments: 1,
      taskActivities: 1,
      taskSeconds: 600,
      taskWords: 200,
      entryActivities: 1,
      projectSeconds: 600,
      projectWords: 200,
      projectTaskWords: 300,
      statusHistory: 1,
    });
  });

  it('gives a stranger nothing at all', async () => {
    await expect(read(s.stranger)).resolves.toEqual({
      subtasks: 0,
      comments: 0,
      labels: 0,
      attachments: 0,
      taskActivities: 0,
      taskSeconds: null,
      taskWords: null,
      entryActivities: 0,
      projectSeconds: null,
      projectWords: null,
      projectTaskWords: null,
      statusHistory: 0,
    });
  });
});
