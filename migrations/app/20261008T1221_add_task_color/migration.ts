#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1db313cea769f420991acfd7b28bc023ebbb117ddfea3a49ce01d220e37184f4/contract';
import endContract from '../../snapshots/1db313cea769f420991acfd7b28bc023ebbb117ddfea3a49ce01d220e37184f4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ed5545fe8b201c15b947cea71571148fadd7524e7d91cd481b714a3fc5b7c37b/contract';
import startContract from '../../snapshots/ed5545fe8b201c15b947cea71571148fadd7524e7d91cd481b714a3fc5b7c37b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Task',
        column: col('color', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
