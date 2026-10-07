type Aggregate = (
  fn: (a: { count(): number }) => { n: number },
) => PromiseLike<{ n: number }>;

/** Row count of any Prisma 8 collection (there is no `.count()` terminal). */
export async function countOf(collection: {
  aggregate: unknown;
}): Promise<number> {
  const aggregate = collection.aggregate as Aggregate;
  const { n } = await aggregate.call(collection, (a) => ({ n: a.count() }));
  return n;
}
