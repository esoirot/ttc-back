import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma8Service, Prisma8Tx } from '../../prisma8/prisma8.service';
import { nowDb } from '../../prisma8/timestamp';
import { translationRateFromDb } from '../../translation-rates/repositories/prisma8-translation-rate.repository';
import { CreateChargeInput } from '../dto/create-charge.input';
import { CreateOccupationInput } from '../dto/create-occupation.input';
import { CustomFieldInput } from '../dto/custom-field.input';
import { LanguagePairInput } from '../dto/language-pair.input';
import { UpdateChargeInput } from '../dto/update-charge.input';
import { UpdateOccupationInput } from '../dto/update-occupation.input';
import { ChargeModel, OccupationModel } from '../types/occupation.type';
import { occupationFromDb } from './prisma8-occupation.mapper';
import { OccupationsRepository } from './occupations.repository';

type OccupationType = 'TRANSLATOR' | 'CORRECTOR' | 'CUSTOM';
type ChargeType = 'FIXED' | 'VARIABLE';

const chargeFromDb = ({
  _type,
  ...c
}: Omit<ChargeModel, 'type'> & { _type: string }): ChargeModel => ({
  ...c,
  type: _type,
});

@Injectable()
export class Prisma8OccupationsRepository implements OccupationsRepository {
  constructor(private readonly db: Prisma8Service) {}

  private withRelations(orm = this.db.orm) {
    return orm.public.Occupation.include('charges')
      .include('translationRates')
      .include('languagePairs')
      .include('customFields');
  }

  private toModel(
    row: NonNullable<
      Awaited<
        ReturnType<
          ReturnType<Prisma8OccupationsRepository['withRelations']>['first']
        >
      >
    >,
  ): OccupationModel {
    return {
      ...occupationFromDb(row),
      charges: row.charges.map(chargeFromDb),
      translationRates: row.translationRates.map(translationRateFromDb),
    };
  }

  private async writeLists(
    tx: Prisma8Tx,
    occupationId: number,
    languagePairs: LanguagePairInput[] | null | undefined,
    customFields: CustomFieldInput[] | null | undefined,
  ) {
    if (languagePairs !== undefined) {
      await tx.orm.public.LanguagePair.where({ occupationId }).deleteAndCount();
      if (languagePairs?.length) {
        await tx.orm.public.LanguagePair.createAll(
          languagePairs.map((p) => ({ ...p, occupationId })),
        );
      }
    }
    if (customFields !== undefined) {
      await tx.orm.public.CustomField.where({ occupationId }).deleteAndCount();
      if (customFields?.length) {
        await tx.orm.public.CustomField.createAll(
          customFields.map((f) => ({ ...f, occupationId })),
        );
      }
    }
  }

  async findAll(userId: number): Promise<OccupationModel[]> {
    const rows = await this.withRelations()
      .where({ userId })
      .orderBy((o) => o.createdAt.asc())
      .all();
    return rows.map((r) => this.toModel(r));
  }

  async findById(id: number, userId: number): Promise<OccupationModel> {
    const row = await this.withRelations().first({ id, userId });
    if (!row) throw new NotFoundException(`Occupation ${id} not found`);
    return this.toModel(row);
  }

  async create(
    userId: number,
    data: CreateOccupationInput,
  ): Promise<OccupationModel> {
    const id = await this.db.transaction(async (tx) => {
      const occupation = await tx.orm.public.Occupation.create({
        userId,
        name: data.name,
        occupationType: (data.occupationType ?? 'CUSTOM') as OccupationType,
        companyName: data.companyName ?? null,
        legalForm: data.legalForm ?? null,
        professionalEmail: data.professionalEmail ?? null,
        professionalPhone: data.professionalPhone ?? null,
        website: data.website ?? null,
        timezone: data.timezone ?? null,
        updatedAt: nowDb(),
      });
      await this.writeLists(
        tx,
        occupation.id,
        data.languagePairs ?? [],
        data.customFields ?? [],
      );
      return occupation.id;
    });
    return this.findById(id, userId);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateOccupationInput,
  ): Promise<OccupationModel> {
    await this.findById(id, userId);
    const { id: _id, name, languagePairs, customFields, ...fields } = data;
    await this.db.transaction(async (tx) => {
      await tx.orm.public.Occupation.where({ id }).update({
        ...fields,
        name: name ?? undefined,
        updatedAt: nowDb(),
      });
      await this.writeLists(tx, id, languagePairs, customFields);
    });
    return this.findById(id, userId);
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await this.db.orm.public.Occupation.where({ id }).delete();
  }

  async createCharge(
    userId: number,
    data: CreateChargeInput,
  ): Promise<ChargeModel> {
    const occupation = await this.db.orm.public.Occupation.first({
      id: data.occupationId,
      userId,
    });
    if (!occupation)
      throw new NotFoundException(`Occupation ${data.occupationId} not found`);
    const charge = await this.db.orm.public.Charge.create({
      occupationId: data.occupationId,
      name: data.name,
      amount: data.amount,
      _type: data.type as ChargeType,
    });
    return chargeFromDb(charge);
  }

  private async ownCharge(id: number, userId: number) {
    const charge = await this.db.orm.public.Charge.where((c) =>
      c.occupation.some((o) => o.userId.eq(userId)),
    ).first({ id });
    if (!charge) throw new NotFoundException(`Charge ${id} not found`);
    return charge;
  }

  async updateCharge(
    id: number,
    userId: number,
    data: UpdateChargeInput,
  ): Promise<ChargeModel> {
    await this.ownCharge(id, userId);
    const charge = await this.db.orm.public.Charge.where({ id }).update({
      name: data.name ?? undefined,
      amount: data.amount ?? undefined,
      _type: (data.type ?? undefined) as ChargeType | undefined,
    });
    return chargeFromDb(charge!);
  }

  async deleteCharge(id: number, userId: number): Promise<void> {
    await this.ownCharge(id, userId);
    await this.db.orm.public.Charge.where({ id }).delete();
  }
}
