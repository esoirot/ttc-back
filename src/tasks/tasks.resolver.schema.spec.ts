import { Test } from '@nestjs/testing';
import {
  GraphQLModule,
  GraphQLSchemaHost,
  GqlExecutionContext,
} from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TasksResolver } from './tasks.resolver';
import { TasksService } from './tasks.service';
import { SubtasksService } from './subtasks.service';
import { CommentsService } from './comments.service';
import { LabelsService } from './labels.service';
import { ActivitiesService } from './activities.service';
import { AttachmentsService } from './attachments.service';
import { TaskTimeResolver } from '../time-entries/task-time.resolver';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import type { GqlLoaders } from '../common/graphql/loaders.service';

function makeTestLoaders(): GqlLoaders {
  const listLoader = () => ({ load: jest.fn().mockResolvedValue([]) });
  return {
    subtasksByTask: listLoader(),
    commentsByTask: listLoader(),
    labelsByTask: listLoader(),
    activitiesByTask: listLoader(),
    attachmentsByTask: listLoader(),
    activitiesByTimeEntry: listLoader(),
    statusHistoryByClient: listLoader(),
    totalSecondsByTask: { load: jest.fn().mockResolvedValue(120) },
    totalSecondsByProject: { load: jest.fn().mockResolvedValue(null) },
  } as unknown as GqlLoaders;
}

// Exercises the GraphQL type thunks (`() => Foo`, `type: () => Int`) that
// only run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup.
describe('TasksResolver GraphQL schema', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          context: (request: FastifyRequest, reply: FastifyReply) => ({
            req: request,
            res: reply,
            loaders: makeTestLoaders(),
          }),
        }),
      ],
      providers: [
        TasksResolver,
        TaskTimeResolver,
        {
          provide: TasksService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              projectId: 1,
              title: 'Task',
              status: 'TODO',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        },
        { provide: SubtasksService, useValue: {} },
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
          gql.getContext<{
            req: { user: { id: number } };
          }>().req = { user: { id: 1 } };
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

  it('builds a schema exposing task queries, mutations, and field resolvers', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('task');
    expect(queries).toHaveProperty('tasks');
    expect(queries).toHaveProperty('myTasks');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    for (const name of [
      'createTask',
      'updateTask',
      'deleteTask',
      'createSubtask',
      'updateSubtask',
      'createChecklist',
      'deleteChecklist',
      'renameChecklist',
      'deleteSubtask',
      'createTaskComment',
      'updateTaskComment',
      'deleteTaskComment',
      'createTaskLabel',
      'deleteTaskLabel',
    ]) {
      expect(mutations).toHaveProperty(name);
    }

    const taskType = schema.getType('Task') as unknown as {
      getFields: () => Record<string, unknown>;
    };
    const taskFields = taskType.getFields();
    for (const name of [
      'subtasks',
      'comments',
      'labels',
      'activities',
      'attachments',
      'totalTimeSeconds',
    ]) {
      expect(taskFields).toHaveProperty(name);
    }
  });

  // Field-level `@ResolveField(() => Foo)` return-type thunks are resolved
  // lazily by graphql-js on first real query execution, not eagerly at
  // schema-build time (unlike root @Query/@Mutation thunks). Only an actual
  // query forces them to run.
  it('resolves every task field through a live query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `{
          task(id: 1) {
            id
            subtasks { id }
            comments { id }
            labels { id }
            activities { id }
            attachments { id }
            totalTimeSeconds
          }
        }`,
      },
    });

    const body = JSON.parse(res.payload) as {
      data?: { task?: { id: number; totalTimeSeconds: number | null } };
      errors?: { message: string }[];
    };
    expect(body.errors).toBeUndefined();
    expect(body.data?.task?.id).toBe(1);
    expect(body.data?.task?.totalTimeSeconds).toBe(120);
  });
});
