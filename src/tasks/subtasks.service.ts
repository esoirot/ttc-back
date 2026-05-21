import { Injectable } from '@nestjs/common';
import {
  SubtaskRepository,
  SubtaskModel,
} from './repositories/subtask.repository';
import { CreateSubtaskInput } from './dto/create-subtask.input';
import { UpdateSubtaskInput } from './dto/update-subtask.input';

@Injectable()
export class SubtasksService {
  constructor(private readonly repo: SubtaskRepository) {}

  findByTask(taskId: number): Promise<SubtaskModel[]> {
    return this.repo.findByTask(taskId);
  }

  create(input: CreateSubtaskInput): Promise<SubtaskModel> {
    return this.repo.create(input);
  }

  update(id: number, input: UpdateSubtaskInput): Promise<SubtaskModel> {
    return this.repo.update(id, input);
  }

  async delete(id: number): Promise<boolean> {
    await this.repo.delete(id);
    return true;
  }
}
