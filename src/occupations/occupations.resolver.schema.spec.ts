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
import { OccupationsResolver } from './occupations.resolver';
import { OccupationsService } from './occupations.service';
import {
  TranslatorOccupation,
  CorrectorOccupation,
  CustomOccupation,
} from './entities/occupation.entity';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';

// Exercises the GraphQL type thunks (`() => Foo` decorator args) that only
// run when the schema is actually built — a plain Test.createTestingModule
// resolver spec never triggers them. Mirrors AppModule's GraphQLModule setup
// (same orphanedTypes requirement, see CLAUDE.md "GraphQL schema").
describe('OccupationsResolver GraphQL schema', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const service: Partial<Record<keyof OccupationsService, jest.Mock>> = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createCharge: jest.fn(),
      updateCharge: jest.fn(),
      deleteCharge: jest.fn(),
    };

    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          buildSchemaOptions: {
            orphanedTypes: [
              TranslatorOccupation,
              CorrectorOccupation,
              CustomOccupation,
            ],
          },
          context: (request: FastifyRequest, reply: FastifyReply) => ({
            req: request,
            res: reply,
          }),
        }),
      ],
      providers: [
        OccupationsResolver,
        { provide: OccupationsService, useValue: service },
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
          }>().req = { user: { id: 1, role: 'ADMIN' } };
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

  it('builds a schema exposing Occupation queries and mutations', () => {
    const { schema } = app.get(GraphQLSchemaHost);

    expect(schema.getType('Occupation')).toBeDefined();
    expect(schema.getType('Charge')).toBeDefined();

    const queries = schema.getQueryType()?.getFields() ?? {};
    expect(queries).toHaveProperty('myOccupations');
    expect(queries).toHaveProperty('occupation');

    const mutations = schema.getMutationType()?.getFields() ?? {};
    expect(mutations).toHaveProperty('createOccupation');
    expect(mutations).toHaveProperty('updateOccupation');
    expect(mutations).toHaveProperty('deleteOccupation');
    expect(mutations).toHaveProperty('createCharge');
    expect(mutations).toHaveProperty('updateCharge');
    expect(mutations).toHaveProperty('deleteCharge');

    const updateInput = schema.getType('UpdateOccupationInput');
    const updateFields =
      updateInput && 'getFields' in updateInput ? updateInput.getFields() : {};
    expect(updateFields).toHaveProperty('customFields');
  });
});
