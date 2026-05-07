import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { GqlContext, RequestUser } from '../types/gql-context.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser | undefined => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<GqlContext>().req.user;
  },
);
