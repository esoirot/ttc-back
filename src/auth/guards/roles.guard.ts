import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { GqlContext } from '../types/gql-context.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext<GqlContext>().req.user;
    if (!roles.includes(user?.role ?? '')) return false;

    const permission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;

    const adminPermissions = user?.adminPermissions ?? [];
    if (adminPermissions.length === 0) return true; // empty array = superadmin, sees everything
    if (!adminPermissions.includes(permission)) {
      throw new ForbiddenException(
        `Missing required admin permission: ${permission}`,
      );
    }
    return true;
  }
}
