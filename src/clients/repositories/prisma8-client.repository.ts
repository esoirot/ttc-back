import { assertOwned } from '../../prisma8/ownership';
import { Injectable, NotFoundException } from '@nestjs/common';
import { or } from '@prisma/orm-postgres/orm-client';
import { occupationFromDb } from '../../occupations/repositories/prisma8-occupation.mapper';
import { countOf } from '../../prisma8/count';
import { containsPattern } from '../../prisma8/like';
import { toNumeric } from '../../prisma8/numeric';
import { Prisma8Service, Prisma8Tx } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import { CreateClientInput } from '../dto/create-client.input';
import { CreateCompanyContactInput } from '../dto/create-company-contact.input';
import { UpdateClientInput } from '../dto/update-client.input';
import { UpdateCompanyContactInput } from '../dto/update-company-contact.input';
import { ClientModel, CompanyContactModel } from '../types/client.type';
import { ClientConnectionModel, ClientRepository } from './client.repository';

type Status = ClientModel['status'];
type Industry = NonNullable<
  NonNullable<
    Awaited<ReturnType<Prisma8Service['orm']['public']['Client']['first']>>
  >['industry']
>;
type ClientType = ClientModel['clientType'];

type ContactRow = Omit<CompanyContactModel, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

const contactFromDb = (c: ContactRow): CompanyContactModel => ({
  ...c,
  createdAt: fromDb(c.createdAt),
  updatedAt: fromDb(c.updatedAt),
});

@Injectable()
export class Prisma8ClientRepository implements ClientRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get clients() {
    return this.db.orm.public.Client;
  }

  private full() {
    return this.clients
      .include('contacts')
      .include('tags', (t) =>
        t.include('tag', (tag) => tag.select('id', 'name')),
      )
      .include('occupations', (o) => o.include('occupation'));
  }

  private toModel(
    row: NonNullable<
      Awaited<ReturnType<ReturnType<Prisma8ClientRepository['full']>['first']>>
    >,
  ): ClientModel {
    const { tags, occupations, contacts, ...c } = row;
    return {
      ...c,
      taxRate: c.taxRate === null ? null : Number(c.taxRate),
      contactedAt: fromDb(c.contactedAt),
      createdAt: fromDb(c.createdAt),
      updatedAt: fromDb(c.updatedAt),
      contacts: contacts.map(contactFromDb),
      tags: tags.map((t) => t.tag!),
      occupations: occupations.map((o) => occupationFromDb(o.occupation)),
    };
  }

  private async assertRefs(
    userId: number,
    tagIds?: number[],
    occupationIds?: number[],
  ) {
    await assertOwned(this.db.orm, userId, 'Tag', tagIds);
    await assertOwned(this.db.orm, userId, 'Occupation', occupationIds);
  }

  private async link(
    tx: Prisma8Tx,
    clientId: number,
    tagIds?: number[],
    occupationIds?: number[],
  ) {
    if (tagIds !== undefined) {
      await tx.orm.public.ClientTag.where({ clientId }).deleteAndCount();
      await tx.orm.public.ClientTag.createAll(
        tagIds.map((tagId) => ({ clientId, tagId })),
      );
    }
    if (occupationIds !== undefined) {
      await tx.orm.public.ClientOccupation.where({ clientId }).deleteAndCount();
      await tx.orm.public.ClientOccupation.createAll(
        occupationIds.map((occupationId) => ({ clientId, occupationId })),
      );
    }
  }

  private fields(
    data: Omit<UpdateClientInput, 'id' | 'tagIds' | 'occupationIds'>,
  ) {
    const { taxRate, contactedAt, clientType, status, ...rest } = data;
    return {
      ...rest,
      clientType: clientType as ClientType | undefined,
      status: status as Status | undefined,
      taxRate: toNumeric<5, 2>(taxRate),
      contactedAt: contactedAt === undefined ? undefined : toDb(contactedAt),
    };
  }

  async findById(id: number, userId: number): Promise<ClientModel> {
    const client = await this.full().first({ id, userId });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return this.toModel(client);
  }

  async findByHubspotId(
    userId: number,
    hubspotId: string,
  ): Promise<ClientModel | null> {
    const row = await this.full().first({ userId, hubspotId });
    return row ? this.toModel(row) : null;
  }

  async findByHubspotIdGlobal(hubspotId: string): Promise<ClientModel | null> {
    const row = await this.full().first({ hubspotId });
    return row ? this.toModel(row) : null;
  }

  async findAll(
    userId: number,
    isAdmin: boolean,
    pagination?: { limit?: number; cursor?: number },
    search?: string,
    clientType?: string,
    excludeStatus?: string,
    status?: string,
    industry?: string,
  ): Promise<ClientConnectionModel> {
    const limit = pagination?.limit ?? 20;
    const cursor = pagination?.cursor;
    let base = this.full().where({
      userId: isAdmin ? undefined : userId,
      clientType: (clientType || undefined) as ClientType | undefined,
      status: (status || undefined) as Status | undefined,
      industry: (industry || undefined) as Industry | undefined,
    });
    if (search) {
      // A company's name, or a person's first or last name.
      const pattern = containsPattern(search);
      base = base.where((c) =>
        or(
          c.name.ilike(pattern),
          c.firstName.ilike(pattern),
          c.lastName.ilike(pattern),
        ),
      );
    }
    if (excludeStatus)
      base = base.where((c) => c.status.neq(excludeStatus as Status));
    const page =
      cursor !== undefined ? base.where((c) => c.id.gt(cursor)) : base;
    const rows = await page
      .orderBy((c) => c.id.asc())
      .limit(limit + 1)
      .all();
    const total = await countOf(base);
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) =>
      this.toModel(r),
    );
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
      total,
    };
  }

  async create(userId: number, data: CreateClientInput): Promise<ClientModel> {
    const { tagIds, occupationIds, ...fields } = data;
    await this.assertRefs(userId, tagIds, occupationIds);
    const id = await this.db.transaction(async (tx) => {
      const client = await tx.orm.public.Client.create({
        ...this.fields(fields),
        name: fields.name,
        userId,
        updatedAt: nowDb(),
      });
      await this.link(tx, client.id, tagIds ?? [], occupationIds ?? []);
      return client.id;
    });
    return this.findById(id, userId);
  }

  async update(
    id: number,
    userId: number,
    data: UpdateClientInput,
  ): Promise<ClientModel> {
    const { id: _id, tagIds, occupationIds, ...fields } = data;
    await this.findById(id, userId);
    await this.assertRefs(userId, tagIds, occupationIds);
    await this.db.transaction(async (tx) => {
      await tx.orm.public.Client.where({ id }).update({
        ...this.fields(fields),
        updatedAt: nowDb(),
      });
      await this.link(tx, id, tagIds, occupationIds);
    });
    return this.findById(id, userId);
  }

  async delete(id: number, userId: number): Promise<ClientModel> {
    const client = await this.findById(id, userId);
    await this.db.transaction(async (tx) => {
      await tx.orm.public.Project.where({ clientId: id }).updateAndCount({
        clientId: null,
      });
      await tx.orm.public.Client.where({ id }).delete();
    });
    return client;
  }

  async createContact(
    data: CreateCompanyContactInput,
    userId: number,
  ): Promise<CompanyContactModel> {
    return this.db.transaction(async (tx) => {
      const client = await tx.orm.public.Client.first({
        id: data.clientId,
        userId,
      });
      if (!client)
        throw new NotFoundException(`Client ${data.clientId} not found`);
      return contactFromDb(
        await tx.orm.public.CompanyContact.create({
          ...data,
          updatedAt: nowDb(),
        }),
      );
    });
  }

  private ownContact(tx: Prisma8Tx, id: number, userId: number) {
    return tx.orm.public.CompanyContact.where((c) =>
      c.client.some((cl) => cl.userId.eq(userId)),
    ).first({ id });
  }

  async updateContact(
    id: number,
    userId: number,
    data: UpdateCompanyContactInput,
  ): Promise<CompanyContactModel> {
    const { id: _id, ...fields } = data;
    return this.db.transaction(async (tx) => {
      if (!(await this.ownContact(tx, id, userId)))
        throw new NotFoundException(`Contact ${id} not found`);
      const row = await tx.orm.public.CompanyContact.where({ id }).update({
        ...fields,
        updatedAt: nowDb(),
      });
      return contactFromDb(row!);
    });
  }

  async deleteContact(
    id: number,
    userId: number,
  ): Promise<CompanyContactModel> {
    return this.db.transaction(async (tx) => {
      const contact = await this.ownContact(tx, id, userId);
      if (!contact) throw new NotFoundException(`Contact ${id} not found`);
      await tx.orm.public.CompanyContact.where({ id }).delete();
      return contactFromDb(contact);
    });
  }

  async findStaleFollowUpClientIds(
    cutoffDate: Date,
  ): Promise<{ id: number; userId: number }[]> {
    const cutoff = toDb(cutoffDate);
    return this.clients
      .where({ status: 'FOLLOW_UP_3' })
      .where((c) => c.contactedAt.lt(cutoff))
      .select('id', 'userId')
      .all();
  }

  promoteClients(ids: number[]): Promise<number> {
    return this.clients
      .where((c) => c.id.in(ids))
      .updateAndCount({ status: 'RECONTACT_LATER' });
  }
}
