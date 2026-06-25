import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClockifyService } from './clockify.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { TimeEntriesService } from '../time-entries/time-entries.service';

jest.mock('../common/retry.util');
import { fetchWithRetry } from '../common/retry.util';
const mockFetch = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  email: 'user@example.com',
  clockifyApiKey: 'api-key-abc',
  clockifyUserId: 'cid-123',
  clockifyWorkspaceId: 'ws-456',
  ...overrides,
});

const makeOkResponse = (data: unknown, status = 200) =>
  Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(data),
  } as Response);

const makeErrorResponse = (status: number, message?: string) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(message ? { message } : {}),
  } as Response);

describe('ClockifyService', () => {
  let service: ClockifyService;
  let usersService: {
    findOne: jest.Mock;
    updateClockify: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let timeEntriesService: {
    importEntries: jest.Mock<
      Promise<{ imported: number; skipped: number }>,
      [
        number,
        {
          id: string;
          description: string;
          start: string;
          end: string;
          billable: boolean;
        }[],
      ]
    >;
  };

  beforeEach(async () => {
    usersService = {
      findOne: jest.fn(),
      updateClockify: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { log: jest.fn() };
    timeEntriesService = {
      importEntries: jest.fn<
        Promise<{ imported: number; skipped: number }>,
        [
          number,
          {
            id: string;
            description: string;
            start: string;
            end: string;
            billable: boolean;
          }[],
        ]
      >(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClockifyService,
        { provide: UsersService, useValue: usersService },
        { provide: AuditService, useValue: auditService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        { provide: TimeEntriesService, useValue: timeEntriesService },
      ],
    }).compile();

    service = module.get(ClockifyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatus', () => {
    it('returns connected=true when user has clockifyApiKey', async () => {
      usersService.findOne.mockResolvedValue(makeUser());

      const result = await service.getStatus(1);

      expect(result).toEqual({ connected: true, workspaceId: 'ws-456' });
    });

    it('returns connected=false when user has no clockifyApiKey', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ clockifyApiKey: null, clockifyWorkspaceId: null }),
      );

      const result = await service.getStatus(1);

      expect(result).toEqual({ connected: false, workspaceId: null });
    });
  });

  describe('clearCredentials', () => {
    it('nulls all clockify fields and logs audit', async () => {
      await service.clearCredentials(1);

      expect(usersService.updateClockify).toHaveBeenCalledWith(1, {
        clockifyApiKey: null,
        clockifyUserId: null,
        clockifyWorkspaceId: null,
      });
      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'CLOCKIFY_DISCONNECT',
        'clockify',
      );
    });
  });

  describe('setCredentials', () => {
    it('fetches /user and stores credentials', async () => {
      const clockifyUser = {
        id: 'new-cid',
        email: 'u@clockify.me',
        name: 'User',
      };
      mockFetch.mockResolvedValue(makeOkResponse(clockifyUser));

      await service.setCredentials(1, {
        apiKey: 'new-key',
        workspaceId: 'ws-789',
      });

      expect(usersService.updateClockify).toHaveBeenCalledWith(1, {
        clockifyApiKey: 'new-key',
        clockifyUserId: 'new-cid',
        clockifyWorkspaceId: 'ws-789',
      });
    });

    it('throws HttpException when Clockify API returns error', async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(401, 'Unauthorized'));

      await expect(
        service.setCredentials(1, { apiKey: 'bad-key' }),
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('getWorkspaces', () => {
    it('throws BadRequestException when user has no API key', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ clockifyApiKey: null }),
      );

      await expect(service.getWorkspaces(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns workspaces from Clockify', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const workspaces = [{ id: 'ws-1', name: 'My Workspace' }];
      mockFetch.mockResolvedValue(makeOkResponse(workspaces));

      const result = await service.getWorkspaces(1);

      expect(result).toEqual(workspaces);
    });
  });

  describe('startEntry', () => {
    it('posts to Clockify and logs audit', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const entry = { id: 'entry-1', description: 'Work', timeInterval: {} };
      mockFetch.mockResolvedValue(makeOkResponse(entry));

      const result = await service.startEntry(1, 'ws-456', {
        description: 'Work',
        start: '2024-01-01T00:00:00Z',
        billable: false,
      });

      expect(result).toEqual(entry);
      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'CLOCKIFY_START_ENTRY',
        `clockify:ws-456/entries/entry-1`,
      );
    });

    it('throws ForbiddenException when workspace does not match user', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ clockifyWorkspaceId: 'other-ws' }),
      );

      await expect(service.startEntry(1, 'ws-456', {})).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteEntry', () => {
    it('calls DELETE and logs audit', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      mockFetch.mockResolvedValue(makeOkResponse(null, 204));

      await service.deleteEntry(1, 'ws-456', 'entry-99');

      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'CLOCKIFY_DELETE_ENTRY',
        'clockify:ws-456/entries/entry-99',
      );
    });
  });

  describe('importEntries', () => {
    it('filters out in-progress entries and delegates to timeEntriesService', async () => {
      const entries = [
        {
          id: 'e1',
          description: 'Done',
          billable: true,
          timeInterval: { start: 'S', end: 'E', duration: null },
        },
        {
          id: 'e2',
          description: 'Running',
          billable: false,
          timeInterval: { start: 'S', end: null, duration: null },
        },
      ];
      usersService.findOne.mockResolvedValue(makeUser());
      // getEntries calls getEntriesPage (paginated) — mock fetchWithRetry to return entries then []
      mockFetch
        .mockResolvedValueOnce(makeOkResponse(entries))
        .mockResolvedValueOnce(makeOkResponse([]));
      timeEntriesService.importEntries.mockResolvedValue({
        imported: 1,
        skipped: 0,
      });

      const result = await service.importEntries(1, 'ws-456', {
        start: '2024-01-01',
        end: '2024-01-31',
      });

      expect(timeEntriesService.importEntries).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ id: 'e1' })]),
      );
      // in-progress entry filtered out
      const callArg = timeEntriesService.importEntries.mock.calls[0][1];
      expect(callArg.find((e) => e.id === 'e2')).toBeUndefined();
      expect(result).toEqual({ imported: 1, skipped: 0 });
    });

    it('logs CLOCKIFY_IMPORT_ENTRIES audit event', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      mockFetch.mockResolvedValueOnce(makeOkResponse([]));
      timeEntriesService.importEntries.mockResolvedValue({
        imported: 0,
        skipped: 0,
      });

      await service.importEntries(1, 'ws-456', {
        start: '2024-01-01',
        end: '2024-01-31',
      });

      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'CLOCKIFY_IMPORT_ENTRIES',
        'clockify:ws-456',
        expect.objectContaining({ start: '2024-01-01', end: '2024-01-31' }),
      );
    });
  });

  describe('getUserApiKey error paths', () => {
    it('throws BadRequestException when clockifyApiKey is null', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ clockifyApiKey: null }),
      );

      await expect(service.getWorkspaces(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when workspaceId does not match', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ clockifyWorkspaceId: 'ws-other' }),
      );

      await expect(service.getProjects(1, 'ws-456')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
