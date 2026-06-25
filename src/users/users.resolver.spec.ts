import { Test, TestingModule } from '@nestjs/testing';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  role: 'USER',
  createdAt: new Date(),
  ...overrides,
});

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersResolver, { provide: UsersService, useValue: service }],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('createUser — delegates to service.create', async () => {
    const user = makeUser();
    service.create.mockResolvedValue(user);

    const result = await resolver.createUser({
      email: 'user@example.com',
      name: 'Test',
    });
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
    );
    expect(result).toEqual(user);
  });

  it('findAll — delegates to service.findAll', async () => {
    const users = [makeUser({ id: 1 }), makeUser({ id: 2 })];
    service.findAll.mockResolvedValue(users);

    const result = await resolver.findAll();
    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual(users);
  });

  it('findMembers — delegates to service.findAll', async () => {
    const users = [makeUser()];
    service.findAll.mockResolvedValue(users);

    const result = await resolver.findMembers();
    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual(users);
  });

  it('findOne — delegates to service.findOne with id', async () => {
    const user = makeUser({ id: 3 });
    service.findOne.mockResolvedValue(user);

    const result = await resolver.findOne(3);
    expect(service.findOne).toHaveBeenCalledWith(3);
    expect(result).toEqual(user);
  });

  it('updateUser — extracts id from input and delegates', async () => {
    const user = makeUser({ name: 'Updated' });
    service.update.mockResolvedValue(user);

    const result = await resolver.updateUser({ id: 1, name: 'Updated' });
    expect(service.update).toHaveBeenCalledWith(1, { id: 1, name: 'Updated' });
    expect(result).toEqual(user);
  });

  it('removeUser — delegates to service.delete', async () => {
    service.delete.mockResolvedValue({ id: 1 });

    const result = await resolver.removeUser(1);
    expect(service.delete).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1 });
  });
});
