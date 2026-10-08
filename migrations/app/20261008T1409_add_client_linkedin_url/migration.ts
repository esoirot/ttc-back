#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/16eb0fb1106e4412af5ddbd22dc6a125c6fd9b3300959374797cfdcd20628e18/contract';
import startContract from '../../snapshots/16eb0fb1106e4412af5ddbd22dc6a125c6fd9b3300959374797cfdcd20628e18/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b17559345c1650aa2fdd923dab62fbf7c6b3a7e139fb8ab5bb16a06aa65ebe87/contract';
import endContract from '../../snapshots/b17559345c1650aa2fdd923dab62fbf7c6b3a7e139fb8ab5bb16a06aa65ebe87/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Client',
        column: col('linkedinUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
