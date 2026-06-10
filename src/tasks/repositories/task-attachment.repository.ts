export type TaskAttachmentModel = {
  id: number;
  taskId: number;
  type: string;
  fileName: string | null;
  url: string;
  displayText: string | null;
  storageKey: string | null;
  storageDriver: string | null;
  createdAt: Date;
};

type CreateInput = {
  taskId: number;
  type: string;
  fileName?: string;
  url: string;
  displayText?: string;
  storageKey?: string;
  storageDriver?: string;
};

type UpdateInput = {
  url?: string;
  displayText?: string | null;
};

export abstract class TaskAttachmentRepository {
  abstract findByTask(taskId: number): Promise<TaskAttachmentModel[]>;
  abstract findById(id: number): Promise<TaskAttachmentModel | null>;
  abstract create(data: CreateInput): Promise<TaskAttachmentModel>;
  abstract update(
    id: number,
    data: UpdateInput,
  ): Promise<TaskAttachmentModel | null>;
  abstract delete(id: number): Promise<TaskAttachmentModel | null>;
}
