import { Test } from '@nestjs/testing';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { GqlExecutionContext } from '@nestjs/graphql';
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
import { Task, TaskStatus } from '../src/tasks/entities/task.entity';
import { TaskConnection } from '../src/tasks/types/task-connection.type';

const makeTask = (overrides: Partial<Record<string, unknown>> = {}) =>
  Object.assign(new Task(), {
    id: 1,
    projectId: 1,
    title: 'Test Task',
    status: TaskStatus.TODO,
    sortOrder: 0,
    checklistTitles: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

const makeConn = (items = [makeTask()]): TaskConnection =>
  Object.assign(new TaskConnection(), {
    items,
    nextCursor: null,
    total: items.length,
  });

const TASK_FIELDS = `{ id projectId title status sortOrder checklistTitles }`;

interface GqlResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
}

function gqlBody<T = unknown>(res: request.Response): GqlResult<T> {
  return res.body as GqlResult<T>;
}

describe('TasksResolver (e2e)', () => {
  let app: NestFastifyApplication;
  let tasksService: {
    findOne: jest.Mock;
    findByProject: jest.Mock;
    findByAssignee: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let subtasksService: {
    findByTask: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createChecklist: jest.Mock;
    deleteChecklist: jest.Mock;
    renameChecklist: jest.Mock;
  };
  let commentsService: {
    findByTask: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let labelsService: {
    findByTask: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let activitiesService: { findByTask: jest.Mock; log: jest.Mock };
  let attachmentsService: { findByTask: jest.Mock };

  beforeAll(async () => {
    tasksService = {
      findOne: jest.fn().mockResolvedValue(makeTask()),
      findByProject: jest.fn().mockResolvedValue(makeConn()),
      findByAssignee: jest.fn().mockResolvedValue(makeConn()),
      create: jest.fn().mockResolvedValue(makeTask()),
      update: jest.fn().mockResolvedValue(makeTask({ title: 'Updated' })),
      delete: jest.fn().mockResolvedValue(true),
    };
    subtasksService = {
      findByTask: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 1,
        taskId: 1,
        title: 'Sub',
        done: false,
        checklistTitle: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: jest.fn().mockResolvedValue({
        id: 1,
        taskId: 1,
        title: 'Updated',
        done: true,
        checklistTitle: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      delete: jest.fn().mockResolvedValue(true),
      createChecklist: jest.fn().mockResolvedValue(true),
      deleteChecklist: jest.fn().mockResolvedValue(true),
      renameChecklist: jest.fn().mockResolvedValue(true),
    };
    commentsService = {
      findByTask: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 1,
        taskId: 1,
        body: 'Hi',
        authorId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: jest.fn().mockResolvedValue({
        id: 1,
        taskId: 1,
        body: 'Updated',
        authorId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      delete: jest.fn().mockResolvedValue(true),
    };
    labelsService = {
      findByTask: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: 1,
        taskId: 1,
        name: 'bug',
        color: null,
        createdAt: new Date(),
      }),
      delete: jest.fn().mockResolvedValue(true),
    };
    activitiesService = {
      findByTask: jest.fn().mockResolvedValue([]),
      log: jest.fn(),
    };
    attachmentsService = { findByTask: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          context: (request: FastifyRequest, reply: FastifyReply) => ({
            req: request,
            res: reply,
          }),
        }),
      ],
      providers: [
        TasksResolver,
        { provide: TasksService, useValue: tasksService },
        { provide: SubtasksService, useValue: subtasksService },
        { provide: CommentsService, useValue: commentsService },
        { provide: LabelsService, useValue: labelsService },
        { provide: ActivitiesService, useValue: activitiesService },
        { provide: AttachmentsService, useValue: attachmentsService },
      ],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({
        canActivate: (
          ctx: Parameters<typeof GqlExecutionContext.create>[0],
        ) => {
          const gql = GqlExecutionContext.create(ctx);
          gql.getContext<{
            req: { user: { id: number; role: string } };
          }>().req = { user: { id: 1, role: 'USER' } };
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
  beforeEach(() => jest.clearAllMocks());

  const gql = (query: string, variables?: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/graphql').send({ query, variables });

  it('task(id) — returns task', async () => {
    const res = await gql(`{ task(id: 1) ${TASK_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ task: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.task.id).toBe(1);
  });

  it('tasks(projectId) — returns connection', async () => {
    const res = await gql(
      `{ tasks(projectId: 1) { items ${TASK_FIELDS} total nextCursor } }`,
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ tasks: { items: unknown[] } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.tasks.items).toHaveLength(1);
  });

  it('myTasks — returns connection', async () => {
    const res = await gql(
      `{ myTasks { items ${TASK_FIELDS} total nextCursor } }`,
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('createTask — returns created task', async () => {
    const res = await gql(
      `mutation($input: CreateTaskInput!) { createTask(input: $input) ${TASK_FIELDS} }`,
      { input: { title: 'New', projectId: 1 } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ createTask: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.createTask.id).toBe(1);
  });

  it('updateTask — returns updated task', async () => {
    const res = await gql(
      `mutation($input: UpdateTaskInput!) { updateTask(input: $input) ${TASK_FIELDS} }`,
      { input: { id: 1, title: 'Updated' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('deleteTask — returns true', async () => {
    const res = await gql(`mutation { deleteTask(id: 1) }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ deleteTask: boolean }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.deleteTask).toBe(true);
  });

  it('createSubtask — returns subtask', async () => {
    const res = await gql(
      `mutation($input: CreateSubtaskInput!) { createSubtask(input: $input) { id taskId title done } }`,
      { input: { taskId: 1, title: 'Sub' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('updateSubtask — returns updated subtask', async () => {
    const res = await gql(
      `mutation($input: UpdateSubtaskInput!) { updateSubtask(input: $input) { id done } }`,
      { input: { id: 1, done: true } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('deleteSubtask — returns true', async () => {
    const res = await gql(`mutation { deleteSubtask(id: 1) }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ deleteSubtask: boolean }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.deleteSubtask).toBe(true);
  });

  it('createChecklist — returns true', async () => {
    const res = await gql(
      `mutation { createChecklist(taskId: 1, title: "My List") }`,
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('deleteChecklist — returns true', async () => {
    const res = await gql(
      `mutation { deleteChecklist(taskId: 1, title: "My List") }`,
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('renameChecklist — returns true', async () => {
    const res = await gql(
      `mutation { renameChecklist(taskId: 1, oldTitle: "Old", newTitle: "New") }`,
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('createTaskComment — returns comment', async () => {
    const res = await gql(
      `mutation($input: CreateCommentInput!) { createTaskComment(input: $input) { id taskId body } }`,
      { input: { taskId: 1, body: 'Hi' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('updateTaskComment — returns updated comment', async () => {
    const res = await gql(
      `mutation($input: UpdateCommentInput!) { updateTaskComment(input: $input) { id body } }`,
      { input: { id: 1, body: 'Updated' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('deleteTaskComment — returns true', async () => {
    const res = await gql(`mutation { deleteTaskComment(id: 1) }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ deleteTaskComment: boolean }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.deleteTaskComment).toBe(true);
  });

  it('createTaskLabel — returns label', async () => {
    const res = await gql(
      `mutation($input: CreateTaskLabelInput!) { createTaskLabel(input: $input) { id taskId name } }`,
      { input: { taskId: 1, name: 'bug' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('deleteTaskLabel — returns true', async () => {
    const res = await gql(`mutation { deleteTaskLabel(id: 1) }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ deleteTaskLabel: boolean }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.deleteTaskLabel).toBe(true);
  });

  it('field resolver: task with subtasks+comments+labels+activities+attachments', async () => {
    const res = await gql(
      `{ task(id: 1) { id subtasks { id } comments { id } labels { id } activities { id } attachments { id } } }`,
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{
      task: { subtasks: unknown[]; comments: unknown[] };
    }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.task.subtasks).toEqual([]);
    expect(body.data?.task.comments).toEqual([]);
  });
});
