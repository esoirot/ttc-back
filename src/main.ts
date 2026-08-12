import './instrument';

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import type { FastifyCookieOptions } from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

type CompatReply = FastifyReply & {
  setHeader?: (name: string, value: string) => void;
  end?: (data?: string) => void;
};

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Passport.js was written for Express and calls res.setHeader / res.end during
  // OAuth redirects. Fastify's reply wrapper doesn't have those — shim them.
  const fastifyInstance = app.getHttpAdapter().getInstance();

  const configService = app.get(ConfigService);

  // contentSecurityPolicy disabled: this app hosts its own developer-facing
  // HTML UIs (Swagger at /api, Apollo Sandbox at /graphql) whose inline
  // scripts/styles a default CSP would block. Every other helmet default
  // header (X-Frame-Options, X-Content-Type-Options, HSTS, etc.) stays on.
  await fastifyInstance.register(
    fastifyHelmet as unknown as Parameters<typeof fastifyInstance.register>[0],
    { contentSecurityPolicy: false },
  );

  await fastifyInstance.register(
    fastifyCookie as unknown as Parameters<typeof fastifyInstance.register>[0],
    {
      secret: configService.getOrThrow<string>('COOKIE_SECRET'),
    } as FastifyCookieOptions,
  );

  await fastifyInstance.register(
    fastifyMultipart as unknown as Parameters<
      typeof fastifyInstance.register
    >[0],
    { limits: { fileSize: 10 * 1024 * 1024 } },
  );

  if ((process.env['STORAGE_DRIVER'] ?? 'local') === 'local') {
    await mkdir(join(process.cwd(), 'uploads', 'tasks'), { recursive: true });

    await fastifyInstance.register(
      fastifyStatic as unknown as Parameters<
        typeof fastifyInstance.register
      >[0],
      {
        root: join(process.cwd(), 'uploads'),
        prefix: '/uploads/',
        decorateReply: false,
      },
    );
  }

  // init() registers NestJS's default JSON parser; must run before we replace it.
  await app.init();

  // Capture raw JSON body string for webhook HMAC verification.
  // Replaces the built-in JSON parser; behavior is identical except rawBody is set.
  fastifyInstance.removeContentTypeParser('application/json');
  fastifyInstance.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      (_req as { rawBody?: string }).rawBody = body as string;
      try {
        done(null, JSON.parse(body as string) as unknown);
      } catch {
        done(new Error('Invalid JSON body'), undefined);
      }
    },
  );

  fastifyInstance.addHook('onRequest', async (_req, reply) => {
    const compat = reply as CompatReply;
    if (!compat.setHeader) {
      compat.setHeader = (name: string, value: string): void => {
        reply.header(name, value);
      };
    }
    if (!compat.end) {
      compat.end = (data?: string): void => {
        if (!reply.sent) void reply.send(data ?? '');
      };
    }
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const config = new DocumentBuilder()
    .setTitle('The Translator Companion API')
    .setDescription(
      'REST surface of TTC. Core domain (clients, projects, tasks, invoices, rates) is GraphQL-only — see /graphql. This document covers auth redirects/SSE, file attachments, and third-party integrations (Clockify, HubSpot) that are REST by nature.',
    )
    .setVersion('0.1')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      description: 'JWT access token set as an HTTP-only cookie on login',
    })
    .addTag('auth', 'Google OAuth redirect flow')
    .addTag('auth-events', 'SSE stream of login/logout/token-refresh events')
    .addTag('timer-events', 'SSE stream of timer start/stop state')
    .addTag('attachments', 'Task file/URL attachments')
    .addTag('invoices', 'Invoice PDF export')
    .addTag('audit', 'Admin audit log query')
    .addTag('clockify', 'Clockify time-tracking integration')
    .addTag(
      'hubspot',
      'HubSpot CRM integration (contacts/companies/deals/webhooks)',
    )
    .addTag(
      'graphql',
      'Core domain API — clients, projects, tasks, invoices, rates',
      {
        description: 'Open Apollo Sandbox (live schema + query testing)',
        url: '/graphql',
      },
    )
    .build();
  const documentFactory = () => {
    const document = SwaggerModule.createDocument(app, config);
    // GraphQL is a single endpoint, not a REST resource tree — @nestjs/swagger
    // can't introspect resolvers. Stub it here so /api links out to the real
    // schema instead of omitting the core domain API entirely.
    document.paths['/graphql'] = {
      post: {
        tags: ['graphql'],
        summary: 'GraphQL endpoint — see src/schema.gql for the full schema',
        description:
          'GraphQL API is documented by the generated schema (src/schema.gql) and explorable via Apollo ' +
          'Sandbox by opening /graphql directly in a browser.',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: {
                    type: 'string',
                    description: 'GraphQL query or mutation document',
                  },
                  variables: {
                    type: 'object',
                    description: 'Variables referenced by the query',
                  },
                  operationName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'GraphQL response envelope ({ data, errors })',
          },
        },
        externalDocs: {
          description: 'Open Apollo Sandbox (live schema + query testing)',
          url: '/graphql',
        },
      },
    };
    return document;
  };
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

  const shutdown = async () => {
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
void bootstrap();
