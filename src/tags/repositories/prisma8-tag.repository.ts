import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb } from '../../prisma8/timestamp';
import { TagRepository } from './tag.repository';
import { TagModel } from '../types/tag.type';

function toModel(row: {
  id: number;
  userId: number;
  name: string;
  createdAt: string;
}): TagModel {
  return { ...row, createdAt: fromDb(row.createdAt) };
}

@Injectable()
export class Prisma8TagRepository implements TagRepository {
  constructor(private readonly db: Prisma8Service) {}

  private get tags() {
    return this.db.orm.public.Tag;
  }

  async findAll(userId: number): Promise<TagModel[]> {
    const rows = await this.tags
      .where({ userId })
      .orderBy((t) => t.name.asc())
      .all();
    return rows.map(toModel);
  }

  async findById(id: number, userId: number): Promise<TagModel> {
    const tag = await this.tags.first({ id, userId });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    return toModel(tag);
  }

  async create(userId: number, name: string): Promise<TagModel> {
    return toModel(await this.tags.create({ userId, name: name.trim() }));
  }

  async update(id: number, userId: number, name: string): Promise<TagModel> {
    await this.findById(id, userId);
    const tag = await this.tags.where({ id }).update({ name: name.trim() });
    return toModel(tag!);
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await this.tags.where({ id }).delete();
  }
}
