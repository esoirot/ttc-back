import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { ClientRepository, ClientConnectionModel } from './client.repository';
import { ClientModel, CompanyContactModel } from '../types/client.type';
import { CreateClientInput } from '../dto/create-client.input';
import { UpdateClientInput } from '../dto/update-client.input';
import { CreateCompanyContactInput } from '../dto/create-company-contact.input';
import { UpdateCompanyContactInput } from '../dto/update-company-contact.input';

const INCLUDE_CONTACTS = { contacts: true } as const;

@Injectable()
export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number, userId: number): Promise<ClientModel> {
    const client = await this.prisma.client.findFirst({
      where: { id, userId },
      include: INCLUDE_CONTACTS,
    });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }

  async findByHubspotId(
    userId: number,
    hubspotId: string,
  ): Promise<ClientModel | null> {
    return this.prisma.client.findFirst({
      where: { userId, hubspotId },
      include: INCLUDE_CONTACTS,
    });
  }

  async findByHubspotIdGlobal(hubspotId: string): Promise<ClientModel | null> {
    return this.prisma.client.findFirst({
      where: { hubspotId },
      include: INCLUDE_CONTACTS,
    });
  }

  async findAll(
    userId: number,
    isAdmin: boolean,
    pagination?: { limit?: number; cursor?: number },
    search?: string,
  ): Promise<ClientConnectionModel> {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    const baseWhere = {
      ...(isAdmin ? {} : { userId }),
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };
    const where = {
      ...baseWhere,
      ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
    };
    const rows = await this.prisma.client.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: INCLUDE_CONTACTS,
    });
    const total = await this.prisma.client.count({ where: baseWhere });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items, nextCursor, total };
  }

  async create(userId: number, data: CreateClientInput): Promise<ClientModel> {
    return this.prisma.client.create({
      data: { ...data, userId },
      include: INCLUDE_CONTACTS,
    });
  }

  async update(
    id: number,
    userId: number,
    data: UpdateClientInput,
  ): Promise<ClientModel> {
    const { id: _id, ...fields } = data;
    const existing = await this.prisma.client.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException(`Client ${id} not found`);
    return this.prisma.client.update({
      where: { id },
      data: fields,
      include: INCLUDE_CONTACTS,
    });
  }

  async delete(id: number, userId: number): Promise<ClientModel> {
    const existing = await this.prisma.client.findFirst({
      where: { id, userId },
      include: INCLUDE_CONTACTS,
    });
    if (!existing) throw new NotFoundException(`Client ${id} not found`);
    await this.prisma.project.updateMany({
      where: { clientId: id },
      data: { clientId: null },
    });
    return this.prisma.client.delete({
      where: { id },
      include: INCLUDE_CONTACTS,
    });
  }

  async createContact(
    data: CreateCompanyContactInput,
    userId: number,
  ): Promise<CompanyContactModel> {
    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({
        where: { id: data.clientId, userId },
      });
      if (!client)
        throw new NotFoundException(`Client ${data.clientId} not found`);
      return tx.companyContact.create({ data });
    });
  }

  async updateContact(
    id: number,
    userId: number,
    data: UpdateCompanyContactInput,
  ): Promise<CompanyContactModel> {
    const { id: _id, ...fields } = data;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const contact = await tx.companyContact.findFirst({
          where: { id, client: { userId } },
        });
        if (!contact) throw new NotFoundException(`Contact ${id} not found`);
        return tx.companyContact.update({ where: { id }, data: fields });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(`Contact ${id} not found`);
      }
      throw err;
    }
  }

  async deleteContact(
    id: number,
    userId: number,
  ): Promise<CompanyContactModel> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const contact = await tx.companyContact.findFirst({
          where: { id, client: { userId } },
        });
        if (!contact) throw new NotFoundException(`Contact ${id} not found`);
        return tx.companyContact.delete({ where: { id } });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(`Contact ${id} not found`);
      }
      throw err;
    }
  }
}
