import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ActivitiesRepository } from './activities.repository';
import { ActivityModel, ChargeModel } from '../types/activity.type';
import { CreateActivityInput } from '../dto/create-activity.input';
import { UpdateActivityInput } from '../dto/update-activity.input';
import { CreateChargeInput } from '../dto/create-charge.input';
import { UpdateChargeInput } from '../dto/update-charge.input';

const ACTIVITY_INCLUDE = {
  charges: true,
  languagePairs: true,
  customFields: true,
} as const;

@Injectable()
export class PrismaActivitiesRepository implements ActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: number): Promise<ActivityModel[]> {
    return this.prisma.activity.findMany({
      where: { userId },
      include: ACTIVITY_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: number, userId: number): Promise<ActivityModel> {
    const activity = await this.prisma.activity.findFirst({
      where: { id, userId },
      include: ACTIVITY_INCLUDE,
    });
    if (!activity) throw new NotFoundException(`Activity ${id} not found`);
    return activity;
  }

  create(userId: number, data: CreateActivityInput): Promise<ActivityModel> {
    return this.prisma.activity.create({
      data: {
        userId,
        name: data.name,
        activityType: data.activityType ?? 'CUSTOM',
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
      include: ACTIVITY_INCLUDE,
    });
  }

  async update(
    id: number,
    userId: number,
    data: UpdateActivityInput,
  ): Promise<ActivityModel> {
    const existing = await this.prisma.activity.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Activity ${id} not found`);
    return this.prisma.activity.update({
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
      },
      include: ACTIVITY_INCLUDE,
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.activity.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Activity ${id} not found`);
    await this.prisma.activity.delete({ where: { id } });
  }

  async createCharge(
    userId: number,
    data: CreateChargeInput,
  ): Promise<ChargeModel> {
    const activity = await this.prisma.activity.findFirst({
      where: { id: data.activityId, userId },
    });
    if (!activity)
      throw new NotFoundException(`Activity ${data.activityId} not found`);
    return this.prisma.charge.create({
      data: {
        activityId: data.activityId,
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
      where: { id, activity: { userId } },
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
      where: { id, activity: { userId } },
    });
    if (!charge) throw new NotFoundException(`Charge ${id} not found`);
    await this.prisma.charge.delete({ where: { id } });
  }
}
