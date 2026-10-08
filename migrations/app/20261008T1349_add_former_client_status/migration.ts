#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/16eb0fb1106e4412af5ddbd22dc6a125c6fd9b3300959374797cfdcd20628e18/contract';
import endContract from '../../snapshots/16eb0fb1106e4412af5ddbd22dc6a125c6fd9b3300959374797cfdcd20628e18/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1db313cea769f420991acfd7b28bc023ebbb117ddfea3a49ce01d220e37184f4/contract';
import startContract from '../../snapshots/1db313cea769f420991acfd7b28bc023ebbb117ddfea3a49ce01d220e37184f4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addNativeEnumValue({
        schema: 'public',
        typeName: 'ClientStatus',
        value: 'FORMER_CLIENT',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
