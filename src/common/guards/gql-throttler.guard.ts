import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

const noopRes = { header: () => undefined } as unknown as FastifyReply;
const noopReq = { ip: '0.0.0.0', headers: {} } as unknown as FastifyRequest;

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<string>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context).getContext<{
        req?: FastifyRequest;
      }>();
      // WS subscription — no HTTP req; long-lived connection, not a request burst
      if (!ctx?.req) return true;
    }
    return super.canActivate(context);
  }

  override getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext<{
      req?: FastifyRequest;
      res?: FastifyReply;
    }>();
    if (ctx?.req) return { req: ctx.req, res: ctx.res ?? noopRes };
    const http = context.switchToHttp();
    const rawReq = http.getRequest<FastifyRequest | undefined>();
    const rawRes = http.getResponse<{ header?: unknown } | null>();
    const res =
      rawRes && typeof rawRes.header === 'function'
        ? (rawRes as unknown as FastifyReply)
        : noopRes;
    return { req: rawReq ?? noopReq, res };
  }
}
