import { CreateSubtaskInput } from '../dto/create-subtask.input';
import { UpdateSubtaskInput } from '../dto/update-subtask.input';

export type SubtaskModel = {
  id: number;
  taskId: number;
  checklistTitle: string | null;
  title: string;
  done: boolean;
  dueDate: Date | null;
  wordCount: number | null;
  countInTotal: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export abstract class SubtaskRepository {
  abstract findByTaskIds(
    taskIds: number[],
    userId: number,
  ): Promise<SubtaskModel[]>;
  abstract findById(id: number, userId: number): Promise<SubtaskModel>;
  abstract create(data: CreateSubtaskInput): Promise<SubtaskModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateSubtaskInput,
  ): Promise<SubtaskModel>;
  abstract delete(id: number, userId: number): Promise<SubtaskModel>;
  /** Per project: tasks' own word counts plus their counted checklist items' words. */
  abstract sumWordsByProjectIds(
    projectIds: number[],
    userId: number,
  ): Promise<Map<number, number>>;
  abstract renameChecklist(
    taskId: number,
    oldTitle: string,
    newTitle: string,
  ): Promise<number>;
  abstract deleteByChecklist(taskId: number, title: string): Promise<number>;
}
