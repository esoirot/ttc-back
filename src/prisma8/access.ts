import { or, type ModelAccessor } from '@prisma/orm-postgres/orm-client';
import type { Contract } from '../../generated/prisma8/contract';

// Ownership predicates shared by Prisma 8 repositories.

/** A task is visible to its project's owner and to its assignee. */
export const taskVisibleTo =
  (userId: number) => (t: ModelAccessor<Contract, 'Task', 'public'>) =>
    or(
      t.assigneeId.eq(userId),
      t.project.some((p) => p.userId.eq(userId)),
    );
