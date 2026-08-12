import DataLoader from 'dataloader';

/**
 * Builds a DataLoader for a one-to-many relation. `fetchMany` receives all
 * keys requested in one tick and returns the flat matching rows; this groups
 * them back per key (defaulting to `[]`) so DataLoader's per-key contract
 * (one result per key, same order as the input keys) is satisfied.
 */
export function createGroupedListLoader<K extends number, V>(
  fetchMany: (keys: readonly K[]) => Promise<V[]>,
  keyOf: (item: V) => K,
): DataLoader<K, V[]> {
  return new DataLoader<K, V[]>(async (keys) => {
    const rows = await fetchMany(keys);
    const byKey = new Map<K, V[]>();
    for (const row of rows) {
      const key = keyOf(row);
      const bucket = byKey.get(key);
      if (bucket) bucket.push(row);
      else byKey.set(key, [row]);
    }
    return keys.map((key) => byKey.get(key) ?? []);
  });
}

/**
 * Builds a DataLoader for a one-to-one aggregate keyed by id (e.g. summed
 * duration per project). `fetchMany` returns a Map of key -> value for the
 * keys requested in one tick; missing keys resolve to `defaultValue`.
 */
export function createMappedValueLoader<K extends number, MapV, Default>(
  fetchMany: (keys: readonly K[]) => Promise<Map<K, MapV>>,
  defaultValue: Default,
): DataLoader<K, MapV | Default> {
  return new DataLoader<K, MapV | Default>(async (keys) => {
    const byKey = await fetchMany(keys);
    return keys.map((key) => byKey.get(key) ?? defaultValue);
  });
}
