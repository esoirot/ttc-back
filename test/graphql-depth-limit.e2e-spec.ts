import { Test } from '@nestjs/testing';
import {
  GraphQLModule,
  Resolver,
  Query,
  ResolveField,
  Parent,
  Field,
  ObjectType,
} from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import depthLimit from 'graphql-depth-limit';

// Mirrors app.module.ts's GraphQLModule.forRootAsync validationRules wiring
// (see src/app.module.ts) but against a tiny self-referential schema so the
// test controls nesting depth directly, independent of any business resolver
// shape. A low limit (3) keeps the fixture query readable.
const MAX_DEPTH = 3;

@ObjectType()
class Node {
  @Field(() => Number)
  id!: number;
}

@Resolver(() => Node)
class NodeResolver {
  @Query(() => Node)
  node(): Node {
    return { id: 1 };
  }

  // Self-referential field resolver: every level of nesting just returns the
  // same node, so the fixture supports arbitrarily deep queries without
  // needing real data — same @ResolveField/@Parent pattern the app's actual
  // field resolvers use (e.g. TasksResolver.subtasks).
  @ResolveField(() => Node)
  self(@Parent() parent: Node): Node {
    return parent;
  }
}

describe('GraphQL query depth limit (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          validationRules: [depthLimit(MAX_DEPTH)],
          context: () => ({}),
        }),
      ],
      providers: [NodeResolver],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  it('rejects a query nested past the configured depth limit', async () => {
    // node -> self -> self -> self -> id = depth 4, one past MAX_DEPTH (3).
    const res = await request(app.getHttpServer()).post('/graphql').send({
      query: `{ node { self { self { self { id } } } } }`,
    });

    const body = res.body as { data?: unknown; errors?: { message: string }[] };
    expect(body.data).toBeUndefined();
    expect(body.errors).toBeDefined();
    expect(body.errors?.[0]?.message).toMatch(
      /exceeds maximum operation depth/i,
    );
  });

  it('allows a query at or under the depth limit', async () => {
    // node -> self -> self -> id = depth 3, at MAX_DEPTH.
    const res = await request(app.getHttpServer()).post('/graphql').send({
      query: `{ node { self { self { id } } } }`,
    });

    const body = res.body as { data?: unknown; errors?: { message: string }[] };
    expect(body.errors).toBeUndefined();
    expect(body.data).toBeDefined();
  });
});
