import { TagModel } from '../types/tag.type';

export abstract class TagRepository {
  abstract findAll(userId: number): Promise<TagModel[]>;
  abstract findById(id: number, userId: number): Promise<TagModel>;
  abstract create(userId: number, name: string): Promise<TagModel>;
  abstract update(id: number, userId: number, name: string): Promise<TagModel>;
  abstract delete(id: number, userId: number): Promise<void>;
}
