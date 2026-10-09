#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2ce56dac6fdd92d55edfc15b490e62791fce9dfa41702e09bc2291049e53868b/contract';
import endContract from '../../snapshots/2ce56dac6fdd92d55edfc15b490e62791fce9dfa41702e09bc2291049e53868b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/508b4261cd40679046ee84df40df2ed8d6e24364a87516997fa8b6f712f7abca/contract';
import startContract from '../../snapshots/508b4261cd40679046ee84df40df2ed8d6e24364a87516997fa8b6f712f7abca/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'CompanyContact',
        column: col('linkedinUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
