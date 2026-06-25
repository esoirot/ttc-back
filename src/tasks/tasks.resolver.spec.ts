import { Test, TestingModule } from '@nestjs/testing';
import { TasksResolver } from './tasks.resolver';
import { TasksService } from './tasks.service';
import { SubtasksService } from './subtasks.service';
import { CommentsService } from './comments.service';
import { LabelsService } from './labels.service';
import { ActivitiesService } from './activities.service';
import { AttachmentsService } from './attachments.service';
import type { Task } from './entities/task.entity';
import { mockTask } from '../__test-helpers__/mock-factories';

const makeParentTask = (overrides: Parameters<typeof mockTask>[0] = {}) =>
  mockTask(overrides) as unknown as Task;

describe('TasksResolver', () => {
  let resolver: TasksResolver;
  let tasksService: {
    findOne: jest.Mock;
    findByProject: jest.Mock;
    findByAssignee: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let subtasksService: {
    findByTask: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    createChecklist: jest.Mock;
    deleteChecklist: jest.Mock;
    renameChecklist: jest.Mock;
  };
  let commentsService: {
    findByTask: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let labelsService: {
    findByTask: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let activitiesService: { findByTask: jest.Mock; log: jest.Mock };
  let attachmentsService: { findByTask: jest.Mock };

  const user = { id: 7 };

  beforeEach(async () => {
    tasksService = {
      findOne: jest.fn(),
      findByProject: jest.fn(),
      findByAssignee: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    subtasksService = {
      findByTask: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createChecklist: jest.fn(),
      deleteChecklist: jest.fn(),
      renameChecklist: jest.fn(),
    };
    commentsService = {
      findByTask: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    labelsService = {
      findByTask: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    activitiesService = { findByTask: jest.fn(), log: jest.fn() };
    attachmentsService = { findByTask: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksResolver,
        { provide: TasksService, useValue: tasksService },
        { provide: SubtasksService, useValue: subtasksService },
        { provide: CommentsService, useValue: commentsService },
        { provide: LabelsService, useValue: labelsService },
        { provide: ActivitiesService, useValue: activitiesService },
        { provide: AttachmentsService, useValue: attachmentsService },
      ],
    }).compile();

    resolver = module.get<TasksResolver>(TasksResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('findOne — delegates to tasksService', async () => {
    const task = mockTask();
    tasksService.findOne.mockResolvedValue(task);

    const result = await resolver.findOne(1);
    expect(tasksService.findOne).toHaveBeenCalledWith(1);
    expect(result).toEqual(task);
  });

  it('findByProject — delegates to tasksService', async () => {
    const conn = { edges: [] };
    tasksService.findByProject.mockResolvedValue(conn);

    const result = await resolver.findByProject(1, { limit: 10 });
    expect(tasksService.findByProject).toHaveBeenCalledWith(1, { limit: 10 });
    expect(result).toEqual(conn);
  });

  it('findMyTasks — delegates with current user id', async () => {
    const conn = { edges: [] };
    tasksService.findByAssignee.mockResolvedValue(conn);

    const result = await resolver.findMyTasks(user);
    expect(tasksService.findByAssignee).toHaveBeenCalledWith(7, undefined);
    expect(result).toEqual(conn);
  });

  it('createTask — delegates with input and user id', async () => {
    const task = mockTask();
    tasksService.create.mockResolvedValue(task);

    const result = await resolver.createTask(user, {
      title: 'Task',
      projectId: 1,
    });
    expect(tasksService.create).toHaveBeenCalledWith(
      { title: 'Task', projectId: 1 },
      7,
    );
    expect(result).toEqual(task);
  });

  it('updateTask — delegates with id, input, user id', async () => {
    const task = mockTask({ title: 'Updated' });
    tasksService.update.mockResolvedValue(task);

    const result = await resolver.updateTask(user, {
      id: 1,
      title: 'Updated',
    });
    expect(tasksService.update).toHaveBeenCalledWith(
      1,
      { id: 1, title: 'Updated' },
      7,
    );
    expect(result).toEqual(task);
  });

  it('deleteTask — delegates to tasksService', async () => {
    tasksService.delete.mockResolvedValue(true);

    const result = await resolver.deleteTask(1);
    expect(tasksService.delete).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  it('subtasks field resolver — delegates to subtasksService', async () => {
    subtasksService.findByTask.mockResolvedValue([]);

    await resolver.subtasks(makeParentTask({ id: 1 }));
    expect(subtasksService.findByTask).toHaveBeenCalledWith(1);
  });

  it('comments field resolver — delegates to commentsService', async () => {
    commentsService.findByTask.mockResolvedValue([]);

    await resolver.comments(makeParentTask({ id: 1 }));
    expect(commentsService.findByTask).toHaveBeenCalledWith(1);
  });

  it('labels field resolver — delegates to labelsService', async () => {
    labelsService.findByTask.mockResolvedValue([]);

    await resolver.labels(makeParentTask({ id: 1 }));
    expect(labelsService.findByTask).toHaveBeenCalledWith(1);
  });

  it('activities field resolver — delegates to activitiesService', async () => {
    activitiesService.findByTask.mockResolvedValue([]);

    await resolver.activities(makeParentTask({ id: 1 }));
    expect(activitiesService.findByTask).toHaveBeenCalledWith(1);
  });

  it('attachments field resolver — delegates to attachmentsService', async () => {
    attachmentsService.findByTask.mockResolvedValue([]);

    await resolver.attachments(makeParentTask({ id: 1 }));
    expect(attachmentsService.findByTask).toHaveBeenCalledWith(1);
  });

  it('updateSubtask — delegates with id, input, user id', async () => {
    const subtask = { id: 1, taskId: 1, title: 'Updated', done: true };
    subtasksService.update.mockResolvedValue(subtask);

    const result = await resolver.updateSubtask(user, {
      id: 1,
      done: true,
    });
    expect(subtasksService.update).toHaveBeenCalledWith(
      1,
      { id: 1, done: true },
      7,
    );
    expect(result).toEqual(subtask);
  });

  it('createSubtask — delegates to subtasksService', async () => {
    const subtask = { id: 1, taskId: 1, title: 'Sub', done: false };
    subtasksService.create.mockResolvedValue(subtask);

    const result = await resolver.createSubtask(user, {
      taskId: 1,
      title: 'Sub',
    });
    expect(subtasksService.create).toHaveBeenCalledWith(
      { taskId: 1, title: 'Sub' },
      7,
    );
    expect(result).toEqual(subtask);
  });

  it('deleteSubtask — delegates to subtasksService', async () => {
    subtasksService.delete.mockResolvedValue(true);

    const result = await resolver.deleteSubtask(user, 5);
    expect(subtasksService.delete).toHaveBeenCalledWith(5, 7);
    expect(result).toBe(true);
  });

  it('createChecklist — delegates to subtasksService', async () => {
    subtasksService.createChecklist.mockResolvedValue(true);

    await resolver.createChecklist(user, 1, 'My Checklist');
    expect(subtasksService.createChecklist).toHaveBeenCalledWith(
      1,
      'My Checklist',
      7,
    );
  });

  it('deleteChecklist — delegates to subtasksService', async () => {
    subtasksService.deleteChecklist.mockResolvedValue(true);

    await resolver.deleteChecklist(user, 1, 'My Checklist');
    expect(subtasksService.deleteChecklist).toHaveBeenCalledWith(
      1,
      'My Checklist',
      7,
    );
  });

  it('renameChecklist — delegates to subtasksService', async () => {
    subtasksService.renameChecklist.mockResolvedValue(true);

    await resolver.renameChecklist(user, 1, 'Old', 'New');
    expect(subtasksService.renameChecklist).toHaveBeenCalledWith(
      1,
      'Old',
      'New',
      7,
    );
  });

  it('createTaskComment — delegates to commentsService', async () => {
    const comment = { id: 1, taskId: 1, body: 'Hi', authorId: 7 };
    commentsService.create.mockResolvedValue(comment);

    const result = await resolver.createTaskComment(user, {
      taskId: 1,
      body: 'Hi',
    });
    expect(commentsService.create).toHaveBeenCalledWith(
      { taskId: 1, body: 'Hi' },
      7,
    );
    expect(result).toEqual(comment);
  });

  it('updateTaskComment — delegates with id, input, user id', async () => {
    const comment = { id: 1, taskId: 1, body: 'Updated', authorId: 7 };
    commentsService.update.mockResolvedValue(comment);

    const result = await resolver.updateTaskComment(user, {
      id: 1,
      body: 'Updated',
    });
    expect(commentsService.update).toHaveBeenCalledWith(
      1,
      { id: 1, body: 'Updated' },
      7,
    );
    expect(result).toEqual(comment);
  });

  it('deleteTaskComment — delegates to commentsService', async () => {
    commentsService.delete.mockResolvedValue(true);

    const result = await resolver.deleteTaskComment(user, 3);
    expect(commentsService.delete).toHaveBeenCalledWith(3, 7);
    expect(result).toBe(true);
  });

  it('createTaskLabel — delegates to labelsService', async () => {
    const label = { id: 1, taskId: 1, name: 'bug' };
    labelsService.create.mockResolvedValue(label);

    const result = await resolver.createTaskLabel({
      taskId: 1,
      name: 'bug',
    });
    expect(labelsService.create).toHaveBeenCalledWith({
      taskId: 1,
      name: 'bug',
    });
    expect(result).toEqual(label);
  });

  it('deleteTaskLabel — delegates to labelsService', async () => {
    labelsService.delete.mockResolvedValue(true);

    const result = await resolver.deleteTaskLabel(2);
    expect(labelsService.delete).toHaveBeenCalledWith(2);
    expect(result).toBe(true);
  });
});
