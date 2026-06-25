import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { ProjectRepository } from './repositories/projects.repository';
import { AuditService } from '../audit/audit.service';
import { mockProject } from '../__test-helpers__/mock-factories';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repo: {
    findById: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('returns created project and logs PROJECT_CREATE audit', async () => {
      const project = mockProject({
        id: 10,
        title: 'My Project',
        status: 'DRAFT',
      });
      repo.create.mockResolvedValue(project);

      const result = await service.create(1, { title: 'My Project' });

      expect(repo.create).toHaveBeenCalledWith(1, { title: 'My Project' });
      expect(audit.log).toHaveBeenCalledWith(1, 'PROJECT_CREATE', 'project', {
        projectId: 10,
        title: 'My Project',
        status: 'DRAFT',
      });
      expect(result).toEqual(project);
    });
  });

  describe('findAll', () => {
    it('delegates to repository', async () => {
      const connection = { edges: [], pageInfo: { hasNextPage: false } };
      repo.findAll.mockResolvedValue(connection);

      const result = await service.findAll(
        1,
        false,
        'IN_PROGRESS',
        { limit: 5 },
        'search',
      );
      expect(repo.findAll).toHaveBeenCalledWith(
        1,
        false,
        'IN_PROGRESS',
        { limit: 5 },
        'search',
      );
      expect(result).toEqual(connection);
    });
  });

  describe('findOne', () => {
    it('delegates to repository', async () => {
      const project = mockProject();
      repo.findById.mockResolvedValue(project);

      const result = await service.findOne(1, 1);
      expect(repo.findById).toHaveBeenCalledWith(1, 1);
      expect(result).toEqual(project);
    });

    it('returns null when project not found', async () => {
      repo.findById.mockResolvedValue(null);

      const result = await service.findOne(999, 1);
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('returns updated project and logs PROJECT_UPDATE audit', async () => {
      const project = mockProject({
        id: 10,
        title: 'Updated',
        status: 'IN_PROGRESS',
      });
      repo.update.mockResolvedValue(project);

      const result = await service.update(10, 1, {
        id: 10,
        title: 'Updated',
      });

      expect(repo.update).toHaveBeenCalledWith(10, 1, {
        id: 10,
        title: 'Updated',
      });
      expect(audit.log).toHaveBeenCalledWith(1, 'PROJECT_UPDATE', 'project', {
        projectId: 10,
        title: 'Updated',
        status: 'IN_PROGRESS',
      });
      expect(result).toEqual(project);
    });
  });

  describe('delete', () => {
    it('returns true and logs PROJECT_DELETE audit', async () => {
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(10, 1);

      expect(repo.delete).toHaveBeenCalledWith(10, 1);
      expect(audit.log).toHaveBeenCalledWith(1, 'PROJECT_DELETE', 'project', {
        projectId: 10,
      });
      expect(result).toBe(true);
    });
  });
});
