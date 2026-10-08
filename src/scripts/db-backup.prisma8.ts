import contractJson from '../../generated/prisma8/contract.json';
import { Prisma8Service, Prisma8Tx } from '../prisma8/prisma8.service';
import { fromDb } from '../prisma8/timestamp';
import { PrismaClientLike } from './db-backup.core';
import { MODEL_ORDER, orderByFor, toClientProperty } from './db-sync.util';

// Backups keep the Prisma 7 JSON format (column names, ISO timestamps,
// canonical decimal text) so files from before and after the port are
// interchangeable. These convert Prisma 8 rows to and from that format.

type FieldMeta = { type: { codecId: string } };
type ModelMeta = {
  fields: Record<string, FieldMeta>;
  storage: { fields: Record<string, { column: string }> };
};
const MODELS = contractJson.domain.namespaces.public
  .models as unknown as Record<string, ModelMeta>;

type Row = Record<string, unknown>;

/** 42.5000 -> 42.5, 20.00 -> 20: the text Prisma 7's Decimal serialised to. */
function canonicalDecimal(value: string): string {
  return value.includes('.')
    ? value.replace(/0+$/, '').replace(/\.$/, '')
    : value;
}

export function rowToBackup(model: string, row: Row): Row {
  const meta = MODELS[model];
  const out: Row = {};
  for (const [field, value] of Object.entries(row)) {
    const codec = meta.fields[field]?.type.codecId;
    const column = meta.storage.fields[field]?.column ?? field;
    out[column] =
      typeof value !== 'string'
        ? value
        : codec === 'pg/timestamp-string@1'
          ? fromDb(value).toISOString()
          : codec === 'pg/numeric@1'
            ? canonicalDecimal(value)
            : value;
  }
  return out;
}

export function rowFromBackup(model: string, row: Row): Row {
  const fieldByColumn = Object.fromEntries(
    Object.entries(MODELS[model].storage.fields).map(([field, { column }]) => [
      column,
      field,
    ]),
  );
  // Postgres reads ISO text (its Z ignored for `timestamp`) and decimal text
  // as-is. Columns the schema has since dropped (an older backup) are skipped.
  return Object.fromEntries(
    Object.entries(row)
      .filter(([column]) => column in fieldByColumn)
      .map(([column, value]) => [fieldByColumn[column], value]),
  );
}

type AnyCollection = {
  orderBy(fns: ((r: Record<string, { asc(): unknown }>) => unknown)[]): {
    all(): PromiseLike<Row[]>;
  };
  deleteAll(): PromiseLike<unknown>;
  createAll(rows: Row[]): PromiseLike<unknown>;
  where(filter: Row): AnyCollection;
};

function collection(orm: Prisma8Service['orm'], model: string): AnyCollection {
  return (orm.public as unknown as Record<string, AnyCollection>)[model];
}

/** `runExport`'s client shape, reading through Prisma 8. */
export function prisma8BackupClient(db: Prisma8Service): PrismaClientLike {
  return Object.fromEntries(
    MODEL_ORDER.map((model) => {
      const orderBy = [orderByFor(model)].flat();
      const findMany = async () => {
        const rows = await collection(db.orm, model)
          .orderBy(
            orderBy.map(
              (o) => (r: Record<string, { asc(): unknown }>) =>
                r[Object.keys(o)[0]].asc(),
            ),
          )
          .all();
        return rows.map((r) => rowToBackup(model, r));
      };
      return [toClientProperty(model), { findMany }];
    }),
  );
}

/** Replaces every table's rows with the backup's, in one transaction. */
export async function importBackup8(
  db: Prisma8Service,
  data: Record<string, Row[]>,
  log: (message: string) => void = () => undefined,
): Promise<void> {
  await db.transaction(async (tx: Prisma8Tx) => {
    for (const model of [...MODEL_ORDER].reverse()) {
      await collection(tx.orm, model).where({}).deleteAll();
    }
    for (const model of MODEL_ORDER) {
      const rows = data[model] ?? [];
      if (rows.length === 0) continue;
      await collection(tx.orm, model).createAll(
        rows.map((r) => rowFromBackup(model, r)),
      );
      log(`imported ${model}: ${rows.length} rows`);
    }
  });
}
