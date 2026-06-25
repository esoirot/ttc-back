import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from './tags.service';
import { TagRepository } from './repositories/tag.repository';
import { mockTag } from '../__test-helpers__/mock-factories';

describe('TagsService', () => {
  let service: TagsService;
  let repo: {
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TagsService, { provide: TagRepository, useValue: repo }],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll delegates to repository', async () => {
    const tags = [mockTag()];
    repo.findAll.mockResolvedValue(tags);

    const result = await service.findAll(1);
    expect(repo.findAll).toHaveBeenCalledWith(1);
    expect(result).toEqual(tags);
  });

  it('findOne delegates to repository', async () => {
    const tag = mockTag();
    repo.findById.mockResolvedValue(tag);

    const result = await service.findOne(1, 1);
    expect(repo.findById).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual(tag);
  });

  it('create delegates to repository', async () => {
    const tag = mockTag({ name: 'urgent' });
    repo.create.mockResolvedValue(tag);

    const result = await service.create(1, 'urgent');
    expect(repo.create).toHaveBeenCalledWith(1, 'urgent');
    expect(result).toEqual(tag);
  });

  it('update delegates to repository', async () => {
    const tag = mockTag({ name: 'renamed' });
    repo.update.mockResolvedValue(tag);

    const result = await service.update(1, 1, 'renamed');
    expect(repo.update).toHaveBeenCalledWith(1, 1, 'renamed');
    expect(result).toEqual(tag);
  });

  it('delete returns true', async () => {
    repo.delete.mockResolvedValue(undefined);

    const result = await service.delete(1, 1);
    expect(repo.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
