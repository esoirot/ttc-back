import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TagRepository } from './tag.repository';
import { TagModel } from '../types/tag.type';

@Injectable()
export class PrismaTagRepository implements TagRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: number): Promise<TagModel[]> {
    return this.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: number, userId: number): Promise<TagModel> {
    const tag = await this.prisma.tag.findFirst({ where: { id, userId } });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    return tag;
  }

  create(userId: number, name: string): Promise<TagModel> {
    return this.prisma.tag.create({ data: { userId, name: name.trim() } });
  }

  async update(id: number, userId: number, name: string): Promise<TagModel> {
    const existing = await this.prisma.tag.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException(`Tag ${id} not found`);
    return this.prisma.tag.update({
      where: { id },
      data: { name: name.trim() },
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    const existing = await this.prisma.tag.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException(`Tag ${id} not found`);
    await this.prisma.tag.delete({ where: { id } });
  }
}
