import { Test, TestingModule } from '@nestjs/testing';
import { ClockifyController } from './clockify.controller';
import { ClockifyService } from './clockify.service';

type AuthRequest = Parameters<ClockifyController['getStatus']>[0];

const makeUser = (id = 1) => ({ id, email: 'u@example.com', role: 'USER' });
const makeReq = (userId = 1) =>
  ({ user: makeUser(userId) }) as unknown as AuthRequest;

describe('ClockifyController', () => {
  let controller: ClockifyController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      getStatus: jest
        .fn()
        .mockResolvedValue({ connected: true, workspaceId: 'ws-1' }),
      clearCredentials: jest.fn().mockResolvedValue(undefined),
      setCredentials: jest.fn().mockResolvedValue(undefined),
      setWorkspace: jest.fn().mockResolvedValue(undefined),
      getWorkspaces: jest.fn().mockResolvedValue([]),
      getProjects: jest.fn().mockResolvedValue([]),
      getActiveEntry: jest.fn().mockResolvedValue(null),
      getEntries: jest.fn().mockResolvedValue([]),
      importEntries: jest.fn().mockResolvedValue({ imported: 0, skipped: 0 }),
      startEntry: jest.fn().mockResolvedValue({ id: 'e1' }),
      stopEntry: jest.fn().mockResolvedValue({ id: 'e1' }),
      updateEntry: jest.fn().mockResolvedValue({ id: 'e1' }),
      deleteEntry: jest.fn().mockResolvedValue(undefined),
      getTags: jest.fn().mockResolvedValue([]),
      createTag: jest.fn().mockResolvedValue({ id: 't1', name: 'tag' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClockifyController],
      providers: [{ provide: ClockifyService, useValue: service }],
    }).compile();

    controller = module.get(ClockifyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getStatus — delegates with userId', async () => {
    await controller.getStatus(makeReq());
    expect(service.getStatus).toHaveBeenCalledWith(1);
  });

  it('clearCredentials — delegates with userId', async () => {
    await controller.clearCredentials(makeReq());
    expect(service.clearCredentials).toHaveBeenCalledWith(1);
  });

  it('setCredentials — passes dto', async () => {
    const dto = { apiKey: 'key' };
    await controller.setCredentials(makeReq(), dto);
    expect(service.setCredentials).toHaveBeenCalledWith(1, dto);
  });

  it('setWorkspace — passes workspaceId', async () => {
    await controller.setWorkspace(makeReq(), 'ws-456');
    expect(service.setWorkspace).toHaveBeenCalledWith(1, 'ws-456');
  });

  it('getProjects — passes workspaceId', async () => {
    await controller.getProjects(makeReq(), 'ws-456');
    expect(service.getProjects).toHaveBeenCalledWith(1, 'ws-456');
  });

  it('getEntries — passes optional start/end', async () => {
    await controller.getEntries(
      makeReq(),
      'ws-456',
      '2024-01-01',
      '2024-01-31',
    );
    expect(service.getEntries).toHaveBeenCalledWith(
      1,
      'ws-456',
      '2024-01-01',
      '2024-01-31',
    );
  });

  it('startEntry — passes dto and workspaceId', async () => {
    const dto = { description: 'Work' };
    await controller.startEntry(makeReq(), 'ws-456', dto);
    expect(service.startEntry).toHaveBeenCalledWith(1, 'ws-456', dto);
  });

  it('stopEntry — passes workspaceId', async () => {
    await controller.stopEntry(makeReq(), 'ws-456');
    expect(service.stopEntry).toHaveBeenCalledWith(1, 'ws-456');
  });

  it('updateEntry — passes entryId and dto', async () => {
    const dto = { start: 'S', billable: false, tagIds: [] };
    await controller.updateEntry(makeReq(), 'ws-456', 'e-99', dto);
    expect(service.updateEntry).toHaveBeenCalledWith(1, 'ws-456', 'e-99', dto);
  });

  it('deleteEntry — passes entryId', async () => {
    await controller.deleteEntry(makeReq(), 'ws-456', 'e-99');
    expect(service.deleteEntry).toHaveBeenCalledWith(1, 'ws-456', 'e-99');
  });

  it('createTag — passes name', async () => {
    await controller.createTag(makeReq(), 'ws-456', 'urgent');
    expect(service.createTag).toHaveBeenCalledWith(1, 'ws-456', 'urgent');
  });

  it('importEntries — passes workspaceId and dto', async () => {
    const dto = { start: '2024-01-01', end: '2024-01-31' };
    await controller.importEntries(makeReq(), 'ws-456', dto);
    expect(service.importEntries).toHaveBeenCalledWith(1, 'ws-456', dto);
  });
});
