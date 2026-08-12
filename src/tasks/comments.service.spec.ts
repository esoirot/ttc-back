import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentRepository } from './repositories/comment.repository';
import { TaskRepository } from './repositories/task.repository';
import { ActivitiesService } from './activities.service';

const makeComment = (overrides = {}) => ({
  id: 1,
  taskId: 1,
  authorId: 7,
  content: 'Nice work',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('CommentsService', () => {
  let service: CommentsService;
  let repo: {
    findByTaskIds: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let activitiesService: { log: jest.Mock };
  let taskRepo: { findById: jest.Mock };

  beforeEach(async () => {
    repo = {
      findByTaskIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    activitiesService = { log: jest.fn().mockResolvedValue(undefined) };
    taskRepo = { findById: jest.fn().mockResolvedValue({ id: 1 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: CommentRepository, useValue: repo },
        { provide: TaskRepository, useValue: taskRepo },
        { provide: ActivitiesService, useValue: activitiesService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates comment and logs COMMENT_ADDED', async () => {
      const comment = makeComment();
      repo.create.mockResolvedValue(comment);

      const result = await service.create({ taskId: 1, body: 'Nice work' }, 7);

      expect(taskRepo.findById).toHaveBeenCalledWith(1, 7);
      expect(repo.create).toHaveBeenCalledWith(
        { taskId: 1, body: 'Nice work' },
        7,
      );
      expect(activitiesService.log).toHaveBeenCalledWith(1, 7, 'COMMENT_ADDED');
      expect(result).toEqual(comment);
    });

    it('rejects commenting on a task the caller cannot access (#20)', async () => {
      taskRepo.findById.mockRejectedValue(
        new NotFoundException('Task 1 not found'),
      );

      await expect(
        service.create({ taskId: 1, body: 'Nice work' }, 7),
      ).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates comment and logs COMMENT_EDITED', async () => {
      const comment = makeComment({ content: 'Updated', taskId: 1 });
      repo.update.mockResolvedValue(comment);

      const result = await service.update(1, { id: 1, body: 'Updated' }, 7);

      expect(repo.update).toHaveBeenCalledWith(
        1,
        { id: 1, body: 'Updated' },
        7,
      );
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'COMMENT_EDITED',
      );
      expect(result).toEqual(comment);
    });
  });

  describe('delete', () => {
    it('deletes comment and logs COMMENT_DELETED', async () => {
      const comment = makeComment({ taskId: 1 });
      repo.delete.mockResolvedValue(comment);

      const result = await service.delete(1, 7);

      expect(repo.delete).toHaveBeenCalledWith(1, 7);
      expect(activitiesService.log).toHaveBeenCalledWith(
        1,
        7,
        'COMMENT_DELETED',
      );
      expect(result).toBe(true);
    });
  });

  describe('findByTaskIds', () => {
    it('delegates to repository', async () => {
      const comments = [makeComment()];
      repo.findByTaskIds.mockResolvedValue(comments);

      const result = await service.findByTaskIds([1], 7);
      expect(repo.findByTaskIds).toHaveBeenCalledWith([1], 7);
      expect(result).toEqual(comments);
    });
  });
});
