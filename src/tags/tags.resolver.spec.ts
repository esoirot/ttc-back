import { Test, TestingModule } from '@nestjs/testing';
import { TagsResolver } from './tags.resolver';
import { TagsService } from './tags.service';
import { mockTag } from '../__test-helpers__/mock-factories';

describe('TagsResolver', () => {
  let resolver: TagsResolver;
  let service: {
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const user = { id: 1, role: 'USER' };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TagsResolver, { provide: TagsService, useValue: service }],
    }).compile();

    resolver = module.get<TagsResolver>(TagsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('findAll — delegates with user id', async () => {
    const tags = [mockTag()];
    service.findAll.mockResolvedValue(tags);

    const result = await resolver.findAll(user);
    expect(service.findAll).toHaveBeenCalledWith(1);
    expect(result).toEqual(tags);
  });

  it('createTag — extracts name from input', async () => {
    const tag = mockTag({ name: 'urgent' });
    service.create.mockResolvedValue(tag);

    const result = await resolver.createTag({ name: 'urgent' }, user);
    expect(service.create).toHaveBeenCalledWith(1, 'urgent');
    expect(result).toEqual(tag);
  });

  it('updateTag — extracts id and name from input', async () => {
    const tag = mockTag({ name: 'renamed' });
    service.update.mockResolvedValue(tag);

    const result = await resolver.updateTag({ id: 1, name: 'renamed' }, user);
    expect(service.update).toHaveBeenCalledWith(1, 1, 'renamed');
    expect(result).toEqual(tag);
  });

  it('deleteTag — delegates to service', async () => {
    service.delete.mockResolvedValue(true);

    const result = await resolver.deleteTag(1, user);
    expect(service.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
