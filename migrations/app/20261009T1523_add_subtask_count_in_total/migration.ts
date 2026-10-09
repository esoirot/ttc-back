#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3c476b1afa4d1a4f6f2d9a95582e8d0cc6adb2b0f1d43272032710f4afb70e61/contract';
import startContract from '../../snapshots/3c476b1afa4d1a4f6f2d9a95582e8d0cc6adb2b0f1d43272032710f4afb70e61/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5685fc026342ce1864a7932deacd4602ee4c1e80150bd8488a88170d0d182763/contract';
import endContract from '../../snapshots/5685fc026342ce1864a7932deacd4602ee4c1e80150bd8488a88170d0d182763/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Subtask',
        column: col('countInTotal', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
