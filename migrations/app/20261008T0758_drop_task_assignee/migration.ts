#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/594c1cc6b56cd9c5de8c6ee73c3201f48df9a785818ced78b2802682008bb4ad/contract';
import startContract from '../../snapshots/594c1cc6b56cd9c5de8c6ee73c3201f48df9a785818ced78b2802682008bb4ad/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ed5545fe8b201c15b947cea71571148fadd7524e7d91cd481b714a3fc5b7c37b/contract';
import endContract from '../../snapshots/ed5545fe8b201c15b947cea71571148fadd7524e7d91cd481b714a3fc5b7c37b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'Task',
        constraint: 'Task_assigneeId_fkey',
        kind: 'foreignKey',
      }),
      this.dropColumn({ schema: 'public', table: 'Task', column: 'assigneeId' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
