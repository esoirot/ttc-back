import type { FastifyRequest, FastifyReply } from 'fastify';
import type { GqlLoaders } from '../../common/graphql/loaders.service';

export type RequestUser = {
  id: number;
  email: string;
  role: string;
  adminPermissions: string[];
};

export interface GqlContext {
  req: FastifyRequest & { user?: RequestUser };
  res: FastifyReply;
  loaders: GqlLoaders;
}
