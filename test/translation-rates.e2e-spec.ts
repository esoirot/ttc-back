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
import { TranslationRatesResolver } from '../src/translation-rates/translation-rates.resolver';
import { TranslationRatesService } from '../src/translation-rates/translation-rates.service';
import { GqlAuthGuard } from '../src/auth/guards/gql-auth.guard';
import {
  TranslationRate,
  TranslationRateType,
} from '../src/translation-rates/entities/translation-rate.entity';
import { IRateBase } from '../src/common/interfaces/rate-base.interface';

const makeRate = (
  overrides: Partial<Record<string, unknown>> = {},
): TranslationRate => {
  const rate = new TranslationRate();
  Object.assign(rate, {
    id: 1,
    userId: 1,
    name: 'Standard Rate',
    amount: 0.08,
    currency: 'EUR',
    type: TranslationRateType.PER_WORD,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });
  return rate;
};

const RATE_FIELDS = `{ id userId name amount currency type }`;

interface GqlResult<T = unknown> {
  data?: T;
  errors?: { message: string }[];
}

function gqlBody<T = unknown>(res: request.Response): GqlResult<T> {
  return res.body as GqlResult<T>;
}

describe('TranslationRatesResolver (e2e)', () => {
  let app: NestFastifyApplication;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeAll(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([makeRate()]),
      findOne: jest.fn().mockResolvedValue(makeRate()),
      create: jest.fn().mockResolvedValue(makeRate({ name: 'New Rate' })),
      update: jest.fn().mockResolvedValue(makeRate({ name: 'Updated' })),
      delete: jest.fn().mockResolvedValue(true),
    };

    const module = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          buildSchemaOptions: {
            orphanedTypes: [IRateBase as never],
          },
          context: (request: FastifyRequest, reply: FastifyReply) => ({
            req: request,
            res: reply,
          }),
        }),
      ],
      providers: [
        TranslationRatesResolver,
        { provide: TranslationRatesService, useValue: service },
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

  it('translationRates — returns list', async () => {
    const res = await gql(`{ translationRates ${RATE_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ translationRates: { id: number }[] }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.translationRates).toHaveLength(1);
    expect(body.data?.translationRates[0]?.id).toBe(1);
  });

  it('translationRate(id) — returns single rate', async () => {
    const res = await gql(`{ translationRate(id: 1) ${RATE_FIELDS} }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ translationRate: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.translationRate.id).toBe(1);
  });

  it('createTranslationRate — returns created rate', async () => {
    const res = await gql(
      `mutation($input: CreateTranslationRateInput!) { createTranslationRate(input: $input) ${RATE_FIELDS} }`,
      {
        input: {
          name: 'New Rate',
          amount: 0.08,
          currency: 'EUR',
          type: 'PER_WORD',
        },
      },
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ createTranslationRate: { id: number } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.createTranslationRate.id).toBe(1);
  });

  it('updateTranslationRate — returns updated rate', async () => {
    const res = await gql(
      `mutation($input: UpdateTranslationRateInput!) { updateTranslationRate(input: $input) ${RATE_FIELDS} }`,
      { input: { id: 1, name: 'Updated' } },
    );
    expect(res.status).toBe(200);
    const body = gqlBody<{ updateTranslationRate: { name: string } }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.updateTranslationRate.name).toBe('Updated');
  });

  it('deleteTranslationRate — returns true', async () => {
    const res = await gql(`mutation { deleteTranslationRate(id: 1) }`);
    expect(res.status).toBe(200);
    const body = gqlBody<{ deleteTranslationRate: boolean }>(res);
    expect(body.errors).toBeUndefined();
    expect(body.data?.deleteTranslationRate).toBe(true);
  });
});
