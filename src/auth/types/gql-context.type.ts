import type { FastifyRequest, FastifyReply } from 'fastify';

export type RequestUser = { id: number; email: string; role: string };

export interface GqlContext {
  req: FastifyRequest & { user?: RequestUser };
  res: FastifyReply;
}
