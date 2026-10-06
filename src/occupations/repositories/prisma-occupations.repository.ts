import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OccupationsRepository } from './occupations.repository';
import { OccupationModel, ChargeModel } from '../types/occupation.type';
import { CreateOccupationInput } from '../dto/create-occupation.input';
import { UpdateOccupationInput } from '../dto/update-occupation.input';
import { CreateChargeInput } from '../dto/create-charge.input';
import { UpdateChargeInput } from '../dto/update-charge.input';

const OCCUPATION_INCLUDE = {
  charges: true,
  translationRates: true,
  languagePairs: true,
  customFields: true,
} as const;

@Injectable()
export class PrismaOccupationsRepository implements OccupationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: number): Promise<OccupationModel[]> {
    return this.prisma.occupation.findMany({
      where: { userId },
      include: OCCUPATION_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: number, userId: number): Promise<OccupationModel> {
    const occupation = await this.prisma.occupation.findFirst({
      where: { id, userId },
      include: OCCUPATION_INCLUDE,
    });
    if (!occupation) throw new NotFoundException(`Occupation ${id} not found`);
    return occupation;
  }

  create(
    userId: number,
    data: CreateOccupationInput,
  ): Promise<OccupationModel> {
    return this.prisma.occupation.create({
      data: {
        userId,
        name: data.name,
        occupationType: data.occupationType ?? 'CUSTOM',
        companyName: data.companyName ?? null,
        legalForm: data.legalForm ?? null,
        professionalEmail: data.professionalEmail ?? null,
        professionalPhone: data.professionalPhone ?? null,
        website: data.website ?? null,
        timezone: data.timezone ?? null,
        ...(data.languagePairs?.length
          ? { languagePairs: { createMany: { data: data.languagePairs } } }
          : {}),
        ...(data.customFields?.length
          ? { customFields: { createMany: { data: data.customFields } } }
          : {}),
      },
      include: OCCUPATION_INCLUDE,
    });
  }

  async update(
    id: number,
    userId: number,
    data: UpdateOccupationInput,
  ): Promise<OccupationModel> {
    const existing = await this.prisma.occupation.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Occupation ${id} not found`);
    return this.prisma.occupation.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.companyName !== undefined
          ? { companyName: data.companyName }
          : {}),
        ...(data.legalForm !== undefined ? { legalForm: data.legalForm } : {}),
        ...(data.professionalEmail !== undefined
          ? { professionalEmail: data.professionalEmail }
          : {}),
        ...(data.professionalPhone !== undefined
          ? { professionalPhone: data.professionalPhone }
          : {}),
        ...(data.website !== undefined ? { website: data.website } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.objectiveQ1 !== undefined
          ? { objectiveQ1: data.objectiveQ1 }
          : {}),
        ...(data.objectiveQ2 !== undefined
          ? { objectiveQ2: data.objectiveQ2 }
          : {}),
        ...(data.objectiveQ3 !== undefined
          ? { objectiveQ3: data.objectiveQ3 }
          : {}),
        ...(data.objectiveQ4 !== undefined
          ? { objectiveQ4: data.objectiveQ4 }
          : {}),
        ...(data.languagePairs !== undefined
          ? {
              languagePairs: {
                deleteMany: {},
                ...(data.languagePairs?.length
                  ? { createMany: { data: data.languagePairs } }
                  : {}),
              },
            }
          : {}),
        ...(data.customFields !== undefined
          ? {
              customFields: {
                deleteMany: {},
                ...(data.customFields?.length
                  ? { createMany: { data: data.customFields } }
                  : {}),
              },
            }
          : {}),
      },
      include: OCCUPATION_INCLUDE,
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.occupation.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Occupation ${id} not found`);
    await this.prisma.occupation.delete({ where: { id } });
  }

  async createCharge(
    userId: number,
    data: CreateChargeInput,
  ): Promise<ChargeModel> {
    const occupation = await this.prisma.occupation.findFirst({
      where: { id: data.occupationId, userId },
    });
    if (!occupation)
      throw new NotFoundException(`Occupation ${data.occupationId} not found`);
    return this.prisma.charge.create({
      data: {
        occupationId: data.occupationId,
        name: data.name,
        amount: data.amount,
        type: data.type,
      },
    });
  }

  async updateCharge(
    id: number,
    userId: number,
    data: UpdateChargeInput,
  ): Promise<ChargeModel> {
    const charge = await this.prisma.charge.findFirst({
      where: { id, occupation: { userId } },
    });
    if (!charge) throw new NotFoundException(`Charge ${id} not found`);
    return this.prisma.charge.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.amount != null ? { amount: data.amount } : {}),
        ...(data.type != null ? { type: data.type } : {}),
      },
    });
  }

  async deleteCharge(id: number, userId: number): Promise<void> {
    const charge = await this.prisma.charge.findFirst({
      where: { id, occupation: { userId } },
    });
    if (!charge) throw new NotFoundException(`Charge ${id} not found`);
    await this.prisma.charge.delete({ where: { id } });
  }
}
