interface DbState {
  /** Prisma 8 has recorded which contract the database matches. */
  signed: boolean;
  hasTables: boolean;
}

type Query = (
  sql: string,
) => Promise<{ rows: { signed: boolean; has_tables: boolean }[] }>;

export async function readDbState(query: Query): Promise<DbState> {
  const { rows } = await query(
    `select to_regclass('prisma_contract.marker') is not null as signed,
            exists (select 1 from information_schema.tables
                    where table_schema = 'public') as has_tables`,
  );
  return { signed: rows[0].signed, hasTables: rows[0].has_tables };
}

/**
 * Prisma 8 migrations start from a baseline that creates every table. A
 * database built by Prisma 7 must be signed by release A first, or the
 * baseline would run against tables that already exist.
 */
export function migrateRefusal(state: DbState): string | null {
  if (state.signed || !state.hasTables) return null;
  return (
    'This database has tables but was never signed by Prisma 8. ' +
    'Deploy release A first (commit 633e552: git checkout 633e552, ' +
    'pnpm install, pnpm run prisma:miggen), then come back to this version.'
  );
}
