import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from './repositories/users.repository';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  role: 'USER',
  createdAt: new Date(),
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findById: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateClockify: jest.Mock;
    updateHubspot: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateClockify: jest.fn(),
      updateHubspot: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: UserRepository, useValue: repo }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findOne — delegates to repo.findById', async () => {
    const user = makeUser();
    repo.findById.mockResolvedValue(user);

    const result = await service.findOne(1);
    expect(repo.findById).toHaveBeenCalledWith(1);
    expect(result).toEqual(user);
  });

  it('findAll — delegates to repo.findAll', async () => {
    const users = [makeUser({ id: 1 }), makeUser({ id: 2 })];
    repo.findAll.mockResolvedValue(users);

    const result = await service.findAll();
    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toEqual(users);
  });

  it('create — delegates to repo.create', async () => {
    const user = makeUser();
    repo.create.mockResolvedValue(user);

    const result = await service.create({
      email: 'user@example.com',
      name: 'Test User',
    });
    expect(repo.create).toHaveBeenCalled();
    expect(result).toEqual(user);
  });

  it('update — delegates to repo.update with id and input', async () => {
    const user = makeUser({ name: 'Updated' });
    repo.update.mockResolvedValue(user);

    const result = await service.update(1, { id: 1, name: 'Updated' });
    expect(repo.update).toHaveBeenCalledWith(1, { id: 1, name: 'Updated' });
    expect(result).toEqual(user);
  });

  it('updateClockify — delegates to repo.updateClockify', async () => {
    const user = makeUser();
    repo.updateClockify.mockResolvedValue(user);

    const result = await service.updateClockify(1, {
      clockifyUserId: 'abc',
      clockifyApiKey: 'xyz',
    });
    expect(repo.updateClockify).toHaveBeenCalledWith(1, {
      clockifyUserId: 'abc',
      clockifyApiKey: 'xyz',
    });
    expect(result).toEqual(user);
  });

  it('updateHubspot — delegates to repo.updateHubspot', async () => {
    const user = makeUser();
    repo.updateHubspot.mockResolvedValue(user);

    const result = await service.updateHubspot(1, {
      hubspotAccessToken: 'tok',
      hubspotRefreshToken: 'ref',
      hubspotTokenExpiresAt: new Date(),
    });
    expect(repo.updateHubspot).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ hubspotAccessToken: 'tok' }),
    );
    expect(result).toEqual(user);
  });

  it('delete — calls repo.delete and returns { id }', async () => {
    repo.delete.mockResolvedValue({ id: 5, email: 'bye@example.com' });

    const result = await service.delete(5);
    expect(repo.delete).toHaveBeenCalledWith(5);
    expect(result).toEqual({ id: 5 });
  });
});
