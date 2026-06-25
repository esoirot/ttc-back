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
import { UsersResolver } from '../src/users/users.resolver';
import { UsersService } from '../src/users/users.service';
import { GqlAuthGuard } from '../src/auth/guards/gql-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { User, Role } from '../src/users/entities/user.entity';
import { DeleteUserResponse } from '../src/users/types/delete-user.response';

const makeUser = (overrides: Partial<Record<string, unknown>> = {}): User =>
  Object.assign(new User(), {
    id: 1,
    email: 'test@example.com',
    role: Role.USER,
    twoFactorEnabled: false,
    adminPermissions: [],
    defaultCurrency: 'EUR',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  });

const USER_FIELDS = `{ id email role twoFactorEnabled defaultCurrency }`;

interface GqlResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
}

function gqlBody<T = unknown>(res: request.Response): GqlResult<T> {
  return res.body as GqlResult<T>;
}

describe('UsersResolver (e2e)', () => {
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
      create: jest
        .fn()
        .mockResolvedValue(makeUser({ email: 'new@example.com' })),
      findAll: jest.fn().mockResolvedValue([makeUser()]),
      findOne: jest.fn().mockResolvedValue(makeUser()),
      update: jest
        .fn()
        .mockResolvedValue(makeUser({ email: 'updated@example.com' })),
      delete: jest
        .fn()
        .mockResolvedValue(Object.assign(new DeleteUserResponse(), { id: 1 })),
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
      providers: [UsersResolver, { provide: UsersService, useValue: service }],
    })
      .overrideGuard(GqlAuthGuard)
      .useValue({
        canActivate: (
          ctx: Parameters<typeof GqlExecutionContext.create>[0],
        ) => {
          const gql = GqlExecutionContext.create(ctx);
          gql.getContext<{
            req: { user: { id: number; role: string } };
          }>().req = { user: { id: 1, role: 'ADMIN' } };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
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

  it('createUser — returns created user', async () => {
    const res = await gql(
      `mutation($input: CreateUserInput!) { createUser(createUserInput: $input) ${USER_FIELDS} }`,
      { input: { email: 'new@example.com' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ createUser: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.createUser.id).toBe(1);
  });

  it('users — returns list', async () => {
    const res = await gql(`{ users ${USER_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ users: unknown[] }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.users).toHaveLength(1);
  });

  it('members — returns list (no RolesGuard)', async () => {
    const res = await gql(`{ members ${USER_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ members: unknown[] }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.members).toHaveLength(1);
  });

  it('user(id) — returns single user', async () => {
    const res = await gql(`{ user(id: 1) ${USER_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ user: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.user.id).toBe(1);
  });

  it('updateUser — returns updated user', async () => {
    const res = await gql(
      `mutation($input: UpdateUserInput!) { updateUser(updateUserInput: $input) ${USER_FIELDS} }`,
      { input: { id: 1, email: 'updated@example.com' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('removeUser — returns DeleteUserResponse', async () => {
    const res = await gql(`mutation { removeUser(id: 1) { id } }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ removeUser: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.removeUser.id).toBe(1);
  });
});
