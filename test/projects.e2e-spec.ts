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
import { ProjectsResolver } from '../src/projects/projects.resolver';
import { ProjectsService } from '../src/projects/projects.service';
import { GqlAuthGuard } from '../src/auth/guards/gql-auth.guard';
import { ProjectConnection } from '../src/projects/types/project-connection.type';
import {
  Project,
  ProjectStatus,
} from '../src/projects/entities/project.entity';

const mockProject = (overrides: Partial<Project> = {}): Project =>
  Object.assign(new Project(), {
    id: 1,
    title: 'Test Project',
    status: ProjectStatus.ACTIVE,
    currency: 'EUR',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

const mockConnection = (
  items: Project[] = [mockProject()],
): ProjectConnection =>
  Object.assign(new ProjectConnection(), {
    items,
    nextCursor: null,
    total: items.length,
  });

interface GqlResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
}

function gqlBody<T = unknown>(res: request.Response): GqlResult<T> {
  return res.body as GqlResult<T>;
}

describe('ProjectsResolver (e2e)', () => {
  let app: NestFastifyApplication;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeAll(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockProject()),
      findAll: jest.fn().mockResolvedValue(mockConnection()),
      findOne: jest.fn().mockResolvedValue(mockProject()),
      update: jest.fn().mockResolvedValue(mockProject({ title: 'Updated' })),
      delete: jest.fn().mockResolvedValue(true),
    };

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
        ProjectsResolver,
        { provide: ProjectsService, useValue: service },
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

  describe('Query: projects', () => {
    it('returns connection', async () => {
      const res = await gql(
        `{ projects { items { id title status } total nextCursor } }`,
      );
      expect(res.status).toBe(200);
      const body = gqlBody<{ projects: { items: { title: string }[] } }>(res);
      expect(body.errors).toBeUndefined();
      expect(body.data?.projects.items).toHaveLength(1);
      expect(body.data?.projects.items[0]?.title).toBe('Test Project');
    });

    it('delegates isAdmin=false for USER role', async () => {
      await gql(`{ projects { items { id } total nextCursor } }`);
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        false,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('Query: project(id)', () => {
    it('returns project by id', async () => {
      const res = await gql(`{ project(id: 1) { id title status } }`);
      expect(res.status).toBe(200);
      const body = gqlBody<{ project: { id: number } }>(res);
      expect(body.errors).toBeUndefined();
      expect(body.data?.project.id).toBe(1);
    });

    it('passes userId for non-admin', async () => {
      await gql(`{ project(id: 5) { id } }`);
      expect(service.findOne).toHaveBeenCalledWith(5, 1);
    });
  });

  describe('Mutation: createProject', () => {
    it('creates project and returns it', async () => {
      const res = await gql(
        `mutation($input: CreateProjectInput!) { createProject(input: $input) { id title } }`,
        { input: { title: 'New Project', currency: 'EUR' } },
      );
      expect(res.status).toBe(200);
      const body = gqlBody<{ createProject: { title: string } }>(res);
      expect(body.errors).toBeUndefined();
      expect(body.data?.createProject.title).toBe('Test Project');
      expect(service.create).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'New Project' }),
      );
    });
  });

  describe('Mutation: updateProject', () => {
    it('updates project and returns it', async () => {
      const res = await gql(
        `mutation($input: UpdateProjectInput!) { updateProject(input: $input) { id title } }`,
        { input: { id: 1, title: 'Updated' } },
      );
      expect(res.status).toBe(200);
      const body = gqlBody<{ updateProject: { title: string } }>(res);
      expect(body.errors).toBeUndefined();
      expect(body.data?.updateProject.title).toBe('Updated');
      expect(service.update).toHaveBeenCalledWith(
        1,
        1,
        expect.objectContaining({ id: 1 }),
      );
    });
  });

  describe('Mutation: deleteProject', () => {
    it('deletes project and returns true', async () => {
      const res = await gql(`mutation { deleteProject(id: 1) }`);
      expect(res.status).toBe(200);
      const body = gqlBody<{ deleteProject: boolean }>(res);
      expect(body.errors).toBeUndefined();
      expect(body.data?.deleteProject).toBe(true);
      expect(service.delete).toHaveBeenCalledWith(1, 1);
    });
  });
});
