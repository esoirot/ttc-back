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
import { ClientsResolver } from '../src/clients/clients.resolver';
import { ClientsService } from '../src/clients/clients.service';
import { GqlAuthGuard } from '../src/auth/guards/gql-auth.guard';
import { Client, ClientType } from '../src/clients/entities/client.entity';
import { ClientConnection } from '../src/clients/types/client-connection.type';
import { CompanyContact } from '../src/clients/entities/company-contact.entity';

const makeClient = (overrides: Partial<Record<string, unknown>> = {}): Client =>
  Object.assign(new Client(), {
    id: 1,
    userId: 1,
    name: 'Acme Corp',
    clientType: ClientType.COMPANY,
    billingEndOfMonth: false,
    tags: [],
    contacts: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

const makeConn = (items = [makeClient()]): ClientConnection =>
  Object.assign(new ClientConnection(), {
    items,
    nextCursor: null,
    total: items.length,
  });

const makeContact = (
  overrides: Partial<Record<string, unknown>> = {},
): CompanyContact =>
  Object.assign(new CompanyContact(), {
    id: 1,
    clientId: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

const CLIENT_FIELDS = `{ id userId name clientType billingEndOfMonth }`;

interface GqlResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
}

function gqlBody<T = unknown>(res: request.Response): GqlResult<T> {
  return res.body as GqlResult<T>;
}

describe('ClientsResolver (e2e)', () => {
  let app: NestFastifyApplication;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createContact: jest.Mock;
    updateContact: jest.Mock;
    deleteContact: jest.Mock;
    findByHubspotIdGlobal: jest.Mock;
  };

  beforeAll(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue(makeConn()),
      findOne: jest.fn().mockResolvedValue(makeClient()),
      create: jest.fn().mockResolvedValue(makeClient({ name: 'New Corp' })),
      update: jest.fn().mockResolvedValue(makeClient({ name: 'Updated' })),
      delete: jest.fn().mockResolvedValue(true),
      createContact: jest.fn().mockResolvedValue(makeContact()),
      updateContact: jest
        .fn()
        .mockResolvedValue(makeContact({ firstName: 'Jane' })),
      deleteContact: jest.fn().mockResolvedValue(true),
      findByHubspotIdGlobal: jest.fn().mockResolvedValue(null),
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
        ClientsResolver,
        { provide: ClientsService, useValue: service },
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

  it('clients — returns connection', async () => {
    const res = await gql(
      `{ clients { items ${CLIENT_FIELDS} total nextCursor } }`,
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ clients: { items: unknown[] } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.clients.items).toHaveLength(1);
  });

  it('clients — passes isAdmin=false for USER', async () => {
    await gql(`{ clients { items { id } total nextCursor } }`);
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('clients — passes status and excludeStatus filters through', async () => {
    await gql(
      `query($status: ClientStatus, $excludeStatus: ClientStatus) { clients(status: $status, excludeStatus: $excludeStatus) { items { id } total nextCursor } }`,
      { status: 'CLIENT', excludeStatus: undefined },
    );
    expect(service.findAll).toHaveBeenCalledWith(
      1,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      'CLIENT',
    );
  });

  it('client(id) — returns client', async () => {
    const res = await gql(`{ client(id: 1) ${CLIENT_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ client: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.client.id).toBe(1);
  });

  it('createClient — returns created client', async () => {
    const res = await gql(
      `mutation($input: CreateClientInput!) { createClient(input: $input) ${CLIENT_FIELDS} }`,
      { input: { name: 'New Corp', clientType: 'COMPANY' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ createClient: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.createClient.id).toBe(1);
  });

  it('updateClient — returns updated client', async () => {
    const res = await gql(
      `mutation($input: UpdateClientInput!) { updateClient(input: $input) ${CLIENT_FIELDS} }`,
      { input: { id: 1, name: 'Updated' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('deleteClient — returns true', async () => {
    const res = await gql(`mutation { deleteClient(id: 1) }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ deleteClient: boolean }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.deleteClient).toBe(true);
  });

  it('createCompanyContact — returns contact', async () => {
    const res = await gql(
      `mutation($input: CreateCompanyContactInput!) { createCompanyContact(input: $input) { id clientId } }`,
      { input: { clientId: 1 } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ createCompanyContact: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.createCompanyContact.id).toBe(1);
  });

  it('updateCompanyContact — returns updated contact', async () => {
    const res = await gql(
      `mutation($input: UpdateCompanyContactInput!) { updateCompanyContact(input: $input) { id firstName } }`,
      { input: { id: 1, firstName: 'Jane' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody(res);
    expect(body.errors).toBeUndefined();
  });

  it('deleteCompanyContact — returns true', async () => {
    const res = await gql(`mutation { deleteCompanyContact(id: 1) }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ deleteCompanyContact: boolean }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.deleteCompanyContact).toBe(true);
  });
});
