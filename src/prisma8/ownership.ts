import { NotFoundException } from '@nestjs/common';
import { and } from '@prisma/orm-postgres/orm-client';
import type { Prisma8Service } from './prisma8.service';
import { taskVisibleTo } from './access';

// Ids a write receives from the caller must point at the caller's own rows:
// stored on the caller's records, they come back through nested fields
// (a time entry's task, a client's tags...). Unknown and foreign ids fail
// alike with NotFound, as reading them would.

type Orm = Prisma8Service['orm'];
type Ids = number | null | undefined | (number | null | undefined)[];
type OwnedModel = 'Client' | 'Project' | 'Occupation' | 'Tag' | 'RateSheet';

const wanted = (ids: Ids) => [
  ...new Set([ids].flat().filter((id): id is number => id != null)),
];

function requireAll(model: string, ids: number[], found: { id: number }[]) {
  const have = new Set(found.map((r) => r.id));
  const missing = ids.find((id) => !have.has(id));
  if (missing !== undefined)
    throw new NotFoundException(`${model} ${missing} not found`);
}

type IdQuery = {
  where(p: (r: { id: { in(ids: number[]): unknown } }) => unknown): IdQuery;
  select(f: 'id'): { all(): PromiseLike<{ id: number }[]> };
};

/** Rows of `model` with these ids must belong to `userId`. */
export async function assertOwned(
  orm: Orm,
  userId: number,
  model: OwnedModel,
  ids: Ids,
): Promise<void> {
  const list = wanted(ids);
  if (list.length === 0) return;
  const rows = (orm.public[model] as unknown as { where(f: object): IdQuery })
    .where({ userId })
    .where((r) => r.id.in(list))
    .select('id')
    .all();
  requireAll(model, list, await rows);
}

/** Tasks the user owns (through the project) or is assigned to. */
export async function assertTasksVisible(
  orm: Orm,
  userId: number,
  ids: Ids,
): Promise<void> {
  const list = wanted(ids);
  if (list.length === 0) return;
  const rows = await orm.public.Task.where((t) =>
    and(t.id.in(list), taskVisibleTo(userId)(t)),
  )
    .select('id')
    .all();
  requireAll('Task', list, rows);
}

/** Subtasks of tasks the user can see. */
export async function assertSubtasksVisible(
  orm: Orm,
  userId: number,
  ids: Ids,
): Promise<void> {
  const list = wanted(ids);
  if (list.length === 0) return;
  const rows = await orm.public.Subtask.where((s) =>
    and(s.id.in(list), s.task.some(taskVisibleTo(userId))),
  )
    .select('id')
    .all();
  requireAll('Subtask', list, rows);
}
