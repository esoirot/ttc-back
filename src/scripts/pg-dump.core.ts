/** `pg-dump-*.dump`: never matched by the JSON backup rotation, so it is never auto-deleted. */
export function buildDumpFilename(date: Date): string {
  return `pg-dump-${date.toISOString().replace(/[:.]/g, '-')}.dump`;
}

/** Prisma's DATABASE_URL minus `schema`, a Prisma-only param pg_dump rejects. */
export function toPgDumpUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.delete('schema');
  return url.toString();
}
