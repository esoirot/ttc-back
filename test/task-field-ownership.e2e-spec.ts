import { Test } from '@nestjs/testing';
import { GraphQLModule, GqlExecutionContext } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import request from 'supertest';
import { TasksResolver } from '../src/tasks/tasks.resolver';
import { TasksService } from '../src/tasks/tasks.service';
import { SubtasksService } from '../src/tasks/subtasks.service';
import { CommentsService } from '../src/tasks/comments.service';
import { LabelsService } from '../src/tasks/labels.service';
import { ActivitiesService } from '../src/tasks/activities.service';
import { AttachmentsService } from '../src/tasks/attachments.service';
import { GqlAuthGuard } from '../src/auth/guards/gql-auth.guard';
import { createGroupedListLoader } from '../src/common/graphql/batch-loader.util';
import { Task, TaskStatus } from '../src/tasks/entities/task.entity';
import type { SubtaskModel } from '../src/tasks/repositories/subtask.repository';

interface GqlResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
}

function gqlBody<T = unknown>(res: request.Response): GqlResult<T> {
  return res.body as GqlResult<T>;
}

const OWNER_ID = 1;
const OTHER_USER_ID = 2;
const TASK_ID = 1;

// Regression coverage for arch-todo.txt item 1: field resolvers on Task used
// to call e.g. `subtasksService.findByTask(task.id)` with no userId at all —
// any caller who could get a Task object into the response tree could read
// every nested relation regardless of ownership. This proves the fix holds
// even in the worst case where the *parent* query's own authorization is
// bypassed/buggy: the field resolver must independently narrow to the
// requesting user via the loader, not just trust the parent was scoped.
describe('Task field resolver ownership (e2e)', () => {
  let app: NestFastifyApplication;
  let currentUserId: number;

  const makeOwnedTask = () =>
    Object.assign(new Task(), {
      id: TASK_ID,
      projectId: 1,
      title: 'Owner-only task',
      status: TaskStatus.TODO,
      sortOrder: 0,
      checklistTitles: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });

  beforeAll(async () => {
    currentUserId = OWNER_ID;

    // Deliberately permissive: resolves the same task regardless of caller,
    // so the field-resolver-level assertions below are isolated from
    // whatever the top-level query's own authorization does.
    const tasksService = {
      findOne: jest.fn().mockResolvedValue(makeOwnedTask()),
    };

    // Ownership-aware at the service boundary, mirroring what the real
    // repository's `task: { OR: [{ project: { userId } }, { assigneeId }] }`
    // filter does: only the owning user's id yields the real row.
    const subtasksService = {
      findByTaskIds: jest.fn(
        (taskIds: number[], userId: number): Promise<SubtaskModel[]> =>
          Promise.resolve(
            userId === OWNER_ID
              ? (taskIds.map((id) => ({
                  id: 100 + id,
                  taskId: id,
                })) as SubtaskModel[])
              : [],
          ),
      ),
    };

    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          // Wires only the loader this spec exercises (subtasksByTask),
          // built the same way LoadersService builds it in production
          // (src/common/graphql/loaders.service.ts) — a grouped batch loader
          // over the service's findByTaskIds, userId read lazily per call.
          context: (request: FastifyRequest, reply: FastifyReply) => ({
            req: request,
            res: reply,
            loaders: {
              subtasksByTask: createGroupedListLoader<number, SubtaskModel>(
                (taskIds) =>
                  subtasksService.findByTaskIds([...taskIds], currentUserId),
                (s) => s.taskId,
              ),
            },
          }),
        }),
      ],
      providers: [
        TasksResolver,
        { provide: TasksService, useValue: tasksService },
        { provide: SubtasksService, useValue: subtasksService },
        { provide: CommentsService, useValue: {} },
        { provide: LabelsService, useValue: {} },
        { provide: ActivitiesService, useValue: {} },
        { provide: AttachmentsService, useValue: {} },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({
        canActivate: (
          ctx: Parameters<typeof GqlExecutionContext.create>[0],
        ) => {
          const gql = GqlExecutionContext.create(ctx);
          gql.getContext<{ req: { user: { id: number } } }>().req = {
            user: { id: currentUserId },
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  const QUERY = `{ task(id: ${TASK_ID}) { id subtasks { id } } }`;

  it("returns the owner's subtasks when the requester owns the task", async () => {
    currentUserId = OWNER_ID;

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: QUERY });

    const body = gqlBody<{ task: { id: number; subtasks: { id: number }[] } }>(
      res,
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.task.subtasks).toEqual([{ id: 101 }]);
  });

  it('returns no subtasks for a different authenticated user, even though the parent task query resolved', async () => {
    currentUserId = OTHER_USER_ID;

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: QUERY });

    const body = gqlBody<{ task: { id: number; subtasks: unknown[] } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.task.id).toBe(TASK_ID);
    expect(body.data?.task.subtasks).toEqual([]);
  });
});
