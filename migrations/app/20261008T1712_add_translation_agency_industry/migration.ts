#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/508b4261cd40679046ee84df40df2ed8d6e24364a87516997fa8b6f712f7abca/contract';
import endContract from '../../snapshots/508b4261cd40679046ee84df40df2ed8d6e24364a87516997fa8b6f712f7abca/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b17559345c1650aa2fdd923dab62fbf7c6b3a7e139fb8ab5bb16a06aa65ebe87/contract';
import startContract from '../../snapshots/b17559345c1650aa2fdd923dab62fbf7c6b3a7e139fb8ab5bb16a06aa65ebe87/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addNativeEnumValue({
        schema: 'public',
        typeName: 'ClientIndustry',
        value: 'TRANSLATION_AGENCY',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
