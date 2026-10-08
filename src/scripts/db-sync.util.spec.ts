import {
  MODEL_ORDER,
  hasSerialId,
  orderByFor,
  toClientProperty,
} from './db-sync.util';

// [model, ...modelsItDependsOn] per FK fields in prisma/schema.prisma
import contractJson from '../../generated/prisma8/contract.json';

type ModelMeta = {
  fields: Record<string, unknown>;
  relations: Record<string, { cardinality: string; to: { model: string } }>;
};

const SCHEMA_MODELS = Object.entries(
  contractJson.domain.namespaces.public.models as unknown as Record<
    string,
    ModelMeta
  >,
).map(([name, model]) => ({
  name,
  hasId: 'id' in model.fields,
  fkTargets: Object.values(model.relations)
    .filter((r) => r.cardinality === 'N:1')
    .map((r) => r.to.model)
    .filter((target) => target !== name),
}));

describe('MODEL_ORDER', () => {
  it('lists every model exactly once', () => {
    expect(new Set(MODEL_ORDER).size).toBe(MODEL_ORDER.length);
  });

  it('covers every model in the Prisma 8 contract, so backups miss no table', () => {
    expect([...MODEL_ORDER].sort()).toEqual(
      SCHEMA_MODELS.map((m) => m.name).sort(),
    );
  });

  it('places every model after all models it has an FK to', () => {
    const indexOf = (name: string) =>
      MODEL_ORDER.indexOf(name as (typeof MODEL_ORDER)[number]);

    for (const { name, fkTargets } of SCHEMA_MODELS) {
      for (const target of fkTargets) {
        expect([name, indexOf(name) > indexOf(target), target]).toEqual([
          name,
          true,
          target,
        ]);
      }
    }
  });
});

describe('hasSerialId', () => {
  it('is true exactly for models with an id column, whose sequence import resets', () => {
    for (const { name, hasId } of SCHEMA_MODELS) {
      expect([name, hasSerialId(name)]).toEqual([name, hasId]);
    }
  });
});

describe('toClientProperty', () => {
  it('lowercases only the first character', () => {
    expect(toClientProperty('User')).toBe('user');
    expect(toClientProperty('TimeEntryTag')).toBe('timeEntryTag');
    expect(toClientProperty('OAuthAccount')).toBe('oAuthAccount');
  });
});

describe('orderByFor', () => {
  it('orders single-PK models by id', () => {
    expect(orderByFor('User')).toEqual({ id: 'asc' });
  });

  // Prisma rejects a single multi-key object for composite-key orderBy —
  // it must be an array of single-key objects.
  it('orders composite-key models as an array of single-key objects', () => {
    expect(orderByFor('TimeEntryTag')).toEqual([
      { timeEntryId: 'asc' },
      { tagId: 'asc' },
    ]);
    expect(orderByFor('ClientTag')).toEqual([
      { clientId: 'asc' },
      { tagId: 'asc' },
    ]);
  });

  it('gives every model without an id column a composite orderBy', () => {
    for (const { name, hasId } of SCHEMA_MODELS.filter((m) => !m.hasId)) {
      expect([name, Array.isArray(orderByFor(name))]).toEqual([name, !hasId]);
    }
  });
});
