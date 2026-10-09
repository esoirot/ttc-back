#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2ce56dac6fdd92d55edfc15b490e62791fce9dfa41702e09bc2291049e53868b/contract';
import startContract from '../../snapshots/2ce56dac6fdd92d55edfc15b490e62791fce9dfa41702e09bc2291049e53868b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/3c476b1afa4d1a4f6f2d9a95582e8d0cc6adb2b0f1d43272032710f4afb70e61/contract';
import endContract from '../../snapshots/3c476b1afa4d1a4f6f2d9a95582e8d0cc6adb2b0f1d43272032710f4afb70e61/contract.json' with { type: 'json' };
import { col, Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    const target = (name: string) => ({
      id: 'postgres' as const,
      details: { schema: 'public', objectType: 'type' as const, name },
    });
    return [
      this.addColumn({
        schema: 'public',
        table: 'Client',
        column: col('toRecontactAt', 'timestamp(3)', {
          codecRef: { codecId: 'pg/timestamp-string@1', typeParams: { precision: 3 } },
        }),
      }),
      // Follow-up 3 is removed: its clients move to Recontact later, logged
      // in their status history like the daily job did.
      rawSql({
        id: 'data.ClientStatus.FOLLOW_UP_3.toRecontactLater',
        label: 'Move FOLLOW_UP_3 clients to RECONTACT_LATER',
        operationClass: 'data',
        target: target('ClientStatus'),
        precheck: [],
        execute: [
          {
            description: 'log FOLLOW_UP_3 -> RECONTACT_LATER in client status history',
            sql: `INSERT INTO "public"."ClientStatusHistory" ("clientId", "userId", "type", "payload") SELECT "id", "userId", 'STATUS_CHANGED', '{"from":"FOLLOW_UP_3","to":"RECONTACT_LATER"}' FROM "public"."Client" WHERE "status" = 'FOLLOW_UP_3'`,
          },
          {
            description: 'move FOLLOW_UP_3 clients to RECONTACT_LATER',
            sql: `UPDATE "public"."Client" SET "status" = 'RECONTACT_LATER', "updatedAt" = CURRENT_TIMESTAMP WHERE "status" = 'FOLLOW_UP_3'`,
          },
        ],
        postcheck: [
          {
            description: 'verify no client is FOLLOW_UP_3',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."Client" WHERE "status" = 'FOLLOW_UP_3') AS "result"`,
          },
        ],
      }),
      // Postgres can't drop an enum value: rebuild the type without it.
      rawSql({
        id: 'recreateNativeEnum.ClientStatus.dropFOLLOW_UP_3',
        label: 'Remove value "FOLLOW_UP_3" from enum type "ClientStatus"',
        operationClass: 'destructive',
        target: target('ClientStatus'),
        precheck: [
          {
            description: 'ensure no client is FOLLOW_UP_3',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."Client" WHERE "status" = 'FOLLOW_UP_3') AS "result"`,
          },
        ],
        execute: [
          { description: 'rename old type', sql: `ALTER TYPE "public"."ClientStatus" RENAME TO "ClientStatus_old"` },
          {
            description: 'create new type',
            sql: `CREATE TYPE "public"."ClientStatus" AS ENUM ('TO_CONTACT', 'CONTACTED', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'TALKING', 'CLIENT', 'RECONTACT_LATER', 'FORMER_CLIENT')`,
          },
          { description: 'drop status default', sql: `ALTER TABLE "public"."Client" ALTER COLUMN "status" DROP DEFAULT` },
          {
            description: 'convert status column',
            sql: `ALTER TABLE "public"."Client" ALTER COLUMN "status" TYPE "public"."ClientStatus" USING "status"::text::"public"."ClientStatus"`,
          },
          {
            description: 'restore status default',
            sql: `ALTER TABLE "public"."Client" ALTER COLUMN "status" SET DEFAULT 'CLIENT'::"public"."ClientStatus"`,
          },
          { description: 'drop old type', sql: `DROP TYPE "public"."ClientStatus_old"` },
        ],
        postcheck: [
          {
            description: 'verify FOLLOW_UP_3 is gone from enum type "ClientStatus"',
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "pg_enum" AS "e" INNER JOIN "pg_type" AS "t" ON "t"."oid" = "e"."enumtypid" INNER JOIN "pg_namespace" AS "n" ON "n"."oid" = "t"."typnamespace" WHERE "n"."nspname" = 'public' AND "t"."typname" = 'ClientStatus' AND "e"."enumlabel" = 'FOLLOW_UP_3') AS "result"`,
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
