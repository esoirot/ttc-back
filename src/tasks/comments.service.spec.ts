import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { CommentRepository } from './repositories/comment.repository';
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
    findByTask: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let activitiesService: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      findByTask: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    activitiesService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: CommentRepository, useValue: repo },
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

      expect(repo.create).toHaveBeenCalledWith(
        { taskId: 1, body: 'Nice work' },
        7,
      );
      expect(activitiesService.log).toHaveBeenCalledWith(1, 7, 'COMMENT_ADDED');
      expect(result).toEqual(comment);
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

  describe('findByTask', () => {
    it('delegates to repository', async () => {
      const comments = [makeComment()];
      repo.findByTask.mockResolvedValue(comments);

      const result = await service.findByTask(1);
      expect(repo.findByTask).toHaveBeenCalledWith(1);
      expect(result).toEqual(comments);
    });
  });
});
