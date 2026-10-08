import { migrateRefusal } from './migrate-guard.core';

describe('migrateRefusal', () => {
  it('lets a signed database migrate', () => {
    expect(migrateRefusal({ signed: true, hasTables: true })).toBeNull();
  });

  it('lets an empty database migrate: the baseline creates the schema', () => {
    expect(migrateRefusal({ signed: false, hasTables: false })).toBeNull();
  });

  it('stops an unsigned database that has tables: release A was skipped', () => {
    expect(migrateRefusal({ signed: false, hasTables: true })).toMatch(
      /deploy release A first/i,
    );
  });
});
