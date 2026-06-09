import './instrument';

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyReply } from 'fastify';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import type { FastifyCookieOptions } from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
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

  await fastifyInstance.register(
    fastifyCookie as unknown as Parameters<typeof fastifyInstance.register>[0],
    {
      secret:
        process.env.COOKIE_SECRET ?? 'fallback-secret-change-in-production',
    } as FastifyCookieOptions,
  );

  await fastifyInstance.register(
    fastifyMultipart as unknown as Parameters<
      typeof fastifyInstance.register
    >[0],
    { limits: { fileSize: 10 * 1024 * 1024 } },
  );

  await mkdir(join(process.cwd(), 'uploads', 'tasks'), { recursive: true });

  await fastifyInstance.register(
    fastifyStatic as unknown as Parameters<typeof fastifyInstance.register>[0],
    {
      root: join(process.cwd(), 'uploads'),
      prefix: '/uploads/',
      decorateReply: false,
    },
  );

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
    .setDescription('The Translator Companion API description')
    .setVersion('0.1')
    .addTag('hubspot things')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
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
