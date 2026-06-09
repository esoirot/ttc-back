export type TaskAttachmentModel = {
  id: number;
  taskId: number;
  type: string;
  fileName: string | null;
  url: string;
  displayText: string | null;
  createdAt: Date;
};

type CreateInput = {
  taskId: number;
  type: string;
  fileName?: string;
  url: string;
  displayText?: string;
};

export abstract class TaskAttachmentRepository {
  abstract findByTask(taskId: number): Promise<TaskAttachmentModel[]>;
  abstract findById(id: number): Promise<TaskAttachmentModel | null>;
  abstract create(data: CreateInput): Promise<TaskAttachmentModel>;
  abstract delete(id: number): Promise<TaskAttachmentModel | null>;
}
