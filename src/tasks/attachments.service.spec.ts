import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentsService } from './attachments.service';
import { TaskAttachmentRepository } from './repositories/task-attachment.repository';
import { ActivitiesService } from './activities.service';
import { StorageRegistry } from '../storage';

const makeAttachment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  taskId: 10,
  type: 'URL' as const,
  url: 'https://example.com/file.pdf',
  fileName: null,
  displayText: 'My Link',
  storageKey: null,
  storageDriver: null,
  createdAt: new Date(),
  ...overrides,
});

const makeStorageProvider = () => ({
  driverName: 'local',
  upload: jest.fn().mockResolvedValue({
    storageKey: 'key/file.pdf',
    url: 'https://cdn.example.com/file.pdf',
  }),
  delete: jest.fn().mockResolvedValue(undefined),
});

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let repo: {
    findByTask: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let activitiesService: { log: jest.Mock };
  let storageRegistry: { get: jest.Mock };
  let storageProvider: ReturnType<typeof makeStorageProvider>;

  beforeEach(async () => {
    repo = {
      findByTask: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    activitiesService = { log: jest.fn().mockResolvedValue(undefined) };
    storageProvider = makeStorageProvider();
    storageRegistry = { get: jest.fn().mockReturnValue(storageProvider) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: TaskAttachmentRepository, useValue: repo },
        { provide: ActivitiesService, useValue: activitiesService },
        { provide: StorageRegistry, useValue: storageRegistry },
      ],
    }).compile();

    service = module.get(AttachmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByTask', () => {
    it('delegates to repo', async () => {
      repo.findByTask.mockResolvedValue([]);
      const result = await service.findByTask(10);
      expect(repo.findByTask).toHaveBeenCalledWith(10);
      expect(result).toEqual([]);
    });
  });

  describe('createFileAttachment', () => {
    it('uploads file, creates record, logs ATTACHMENT_ADDED', async () => {
      const attachment = makeAttachment({
        type: 'FILE',
        fileName: 'doc.pdf',
        url: 'https://cdn.example.com/file.pdf',
        storageKey: 'key/file.pdf',
        storageDriver: 'local',
      });
      repo.create.mockResolvedValue(attachment);

      const buffer = Buffer.from('file-content');
      const result = await service.createFileAttachment(
        10,
        'doc.pdf',
        buffer,
        7,
      );

      expect(storageRegistry.get).toHaveBeenCalledWith(undefined);
      expect(storageProvider.upload).toHaveBeenCalledWith('doc.pdf', buffer);
      expect(repo.create).toHaveBeenCalledWith({
        taskId: 10,
        type: 'FILE',
        fileName: 'doc.pdf',
        url: 'https://cdn.example.com/file.pdf',
        storageKey: 'key/file.pdf',
        storageDriver: 'local',
      });
      expect(activitiesService.log).toHaveBeenCalledWith(
        10,
        7,
        'ATTACHMENT_ADDED',
        {
          name: 'doc.pdf',
          url: 'https://cdn.example.com/file.pdf',
        },
      );
      expect(result).toEqual(attachment);
    });

    it('uses explicit driver when provided', async () => {
      repo.create.mockResolvedValue(makeAttachment());
      await service.createFileAttachment(
        10,
        'doc.pdf',
        Buffer.from('x'),
        7,
        's3',
      );
      expect(storageRegistry.get).toHaveBeenCalledWith('s3');
    });
  });

  describe('createUrlAttachment', () => {
    it('creates URL attachment and logs ATTACHMENT_ADDED', async () => {
      const attachment = makeAttachment();
      repo.create.mockResolvedValue(attachment);

      const result = await service.createUrlAttachment(
        10,
        'https://example.com',
        'My Link',
        7,
      );

      expect(repo.create).toHaveBeenCalledWith({
        taskId: 10,
        type: 'URL',
        url: 'https://example.com',
        displayText: 'My Link',
      });
      expect(activitiesService.log).toHaveBeenCalledWith(
        10,
        7,
        'ATTACHMENT_ADDED',
        {
          name: 'My Link',
          url: 'https://example.com',
        },
      );
      expect(result).toEqual(attachment);
    });

    it('uses url as name when displayText is undefined', async () => {
      repo.create.mockResolvedValue(makeAttachment({ displayText: undefined }));

      await service.createUrlAttachment(
        10,
        'https://example.com',
        undefined,
        7,
      );

      expect(activitiesService.log).toHaveBeenCalledWith(
        10,
        7,
        'ATTACHMENT_ADDED',
        { name: 'https://example.com', url: 'https://example.com' },
      );
    });
  });

  describe('update', () => {
    it('returns null when attachment not found', async () => {
      repo.findById.mockResolvedValue(null);

      const result = await service.update(99, 'https://new.com', 'New Text', 7);

      expect(result).toBeNull();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates and logs ATTACHMENT_UPDATED', async () => {
      const existing = makeAttachment();
      const updated = makeAttachment({
        url: 'https://new.com',
        displayText: 'New Text',
      });
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(updated);

      const result = await service.update(1, 'https://new.com', 'New Text', 7);

      expect(repo.update).toHaveBeenCalledWith(1, {
        url: 'https://new.com',
        displayText: 'New Text',
      });
      expect(activitiesService.log).toHaveBeenCalledWith(
        10,
        7,
        'ATTACHMENT_UPDATED',
        {
          name: 'New Text',
          url: 'https://new.com',
        },
      );
      expect(result).toEqual(updated);
    });

    it('uses url as name when displayText undefined', async () => {
      repo.findById.mockResolvedValue(makeAttachment());
      repo.update.mockResolvedValue(makeAttachment({ url: 'https://new.com' }));

      await service.update(1, 'https://new.com', undefined, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(
        10,
        7,
        'ATTACHMENT_UPDATED',
        { name: 'https://new.com', url: 'https://new.com' },
      );
    });
  });

  describe('delete', () => {
    it('deletes URL attachment and logs ATTACHMENT_DELETED', async () => {
      const attachment = makeAttachment({
        type: 'URL',
        displayText: 'My Link',
      });
      repo.delete.mockResolvedValue(attachment);

      await service.delete(1, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(
        10,
        7,
        'ATTACHMENT_DELETED',
        {
          name: 'My Link',
          url: 'https://example.com/file.pdf',
        },
      );
      // URL type — no storage delete
      expect(storageProvider.delete).not.toHaveBeenCalled();
    });

    it('deletes FILE attachment, logs activity, and removes from storage', async () => {
      const attachment = makeAttachment({
        type: 'FILE',
        fileName: 'doc.pdf',
        storageKey: 'key/doc.pdf',
        storageDriver: 'local',
      });
      repo.delete.mockResolvedValue(attachment);

      await service.delete(1, 7);

      expect(activitiesService.log).toHaveBeenCalledWith(
        10,
        7,
        'ATTACHMENT_DELETED',
        {
          name: 'doc.pdf',
          url: 'https://example.com/file.pdf',
        },
      );
      expect(storageRegistry.get).toHaveBeenCalledWith('local');
      expect(storageProvider.delete).toHaveBeenCalledWith('key/doc.pdf');
    });

    it('falls back to url as storageKey when storageKey is null', async () => {
      const attachment = makeAttachment({
        type: 'FILE',
        fileName: 'doc.pdf',
        storageKey: null,
        storageDriver: null,
        url: 'https://cdn.example.com/file.pdf',
      });
      repo.delete.mockResolvedValue(attachment);

      await service.delete(1, 7);

      expect(storageProvider.delete).toHaveBeenCalledWith(
        'https://cdn.example.com/file.pdf',
      );
    });

    it('does nothing when attachment not found', async () => {
      repo.delete.mockResolvedValue(null);

      await service.delete(99, 7);

      expect(activitiesService.log).not.toHaveBeenCalled();
      expect(storageProvider.delete).not.toHaveBeenCalled();
    });
  });
});
