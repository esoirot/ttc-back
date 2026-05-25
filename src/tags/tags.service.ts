import { Injectable } from '@nestjs/common';
import { TagRepository } from './repositories/tag.repository';
import { TagModel } from './types/tag.type';

@Injectable()
export class TagsService {
  constructor(private readonly repo: TagRepository) {}

  findAll(userId: number): Promise<TagModel[]> {
    return this.repo.findAll(userId);
  }

  findOne(id: number, userId: number): Promise<TagModel> {
    return this.repo.findById(id, userId);
  }

  create(userId: number, name: string): Promise<TagModel> {
    return this.repo.create(userId, name);
  }

  update(id: number, userId: number, name: string): Promise<TagModel> {
    return this.repo.update(id, userId, name);
  }

  async delete(id: number, userId: number): Promise<boolean> {
    await this.repo.delete(id, userId);
    return true;
  }
}
