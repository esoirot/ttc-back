import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsResolver } from './projects.resolver';
import { ProjectsService } from './projects.service';
import { ProjectStatus } from './entities/project.entity';
import { mockProject } from '../__test-helpers__/mock-factories';

describe('ProjectsResolver', () => {
  let resolver: ProjectsResolver;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const user = { id: 1, role: 'USER' };
  const adminUser = { id: 2, role: 'ADMIN' };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsResolver,
        { provide: ProjectsService, useValue: service },
      ],
    }).compile();

    resolver = module.get<ProjectsResolver>(ProjectsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('createProject', () => {
    it('delegates to service with user id', async () => {
      const project = mockProject();
      service.create.mockResolvedValue(project);

      const result = await resolver.createProject({ title: 'New' }, user);
      expect(service.create).toHaveBeenCalledWith(1, { title: 'New' });
      expect(result).toEqual(project);
    });
  });

  describe('findAll', () => {
    it('passes isAdmin=false for USER', async () => {
      const conn = { edges: [] };
      service.findAll.mockResolvedValue(conn);

      await resolver.findAll(
        user,
        ProjectStatus.ACTIVE,
        { limit: 10 },
        'search',
      );
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        false,
        ProjectStatus.ACTIVE,
        { limit: 10 },
        'search',
      );
    });

    it('passes isAdmin=true for ADMIN', async () => {
      service.findAll.mockResolvedValue({ edges: [] });

      await resolver.findAll(adminUser, undefined, undefined, undefined);
      expect(service.findAll).toHaveBeenCalledWith(
        2,
        true,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('findOne', () => {
    it('passes null userId for ADMIN (can see all)', async () => {
      const project = mockProject();
      service.findOne.mockResolvedValue(project);

      const result = await resolver.findOne(5, adminUser);
      expect(service.findOne).toHaveBeenCalledWith(5, null);
      expect(result).toEqual(project);
    });

    it('passes user id for non-admin (own projects only)', async () => {
      const project = mockProject();
      service.findOne.mockResolvedValue(project);

      const result = await resolver.findOne(5, user);
      expect(service.findOne).toHaveBeenCalledWith(5, 1);
      expect(result).toEqual(project);
    });
  });

  describe('updateProject', () => {
    it('delegates with id from input and user id', async () => {
      const project = mockProject({ title: 'Updated' });
      service.update.mockResolvedValue(project);

      const result = await resolver.updateProject(
        { id: 3, title: 'Updated' },
        user,
      );
      expect(service.update).toHaveBeenCalledWith(3, 1, {
        id: 3,
        title: 'Updated',
      });
      expect(result).toEqual(project);
    });
  });

  describe('deleteProject', () => {
    it('delegates to service', async () => {
      service.delete.mockResolvedValue(true);

      const result = await resolver.deleteProject(3, user);
      expect(service.delete).toHaveBeenCalledWith(3, 1);
      expect(result).toBe(true);
    });
  });
});
