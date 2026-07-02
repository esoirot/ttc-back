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

// mockFetch normally resolves directly, bypassing the callback passed to
// fetchWithRetry — so request()'s own fetch() call (headers/body construction)
// never actually runs. This variant makes the mock invoke that callback for
// real, against a controllable global.fetch spy, for tests that need to
// assert on the actual outgoing request.
const invokeRealFetch = () => {
  const fetchSpy = jest.spyOn(globalThis, 'fetch');
  mockFetch.mockImplementation(async (cb) => cb(new AbortController().signal));
  return fetchSpy;
};

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
    // resetAllMocks (not clearAllMocks) — clearAllMocks leaves queued
    // mockResolvedValueOnce()/mockImplementation() entries in place, so an
    // unconsumed once-value from one test can leak into the next.
    jest.resetAllMocks();
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

    it('stores a null workspace id when none is given', async () => {
      mockFetch.mockResolvedValue(
        makeOkResponse({ id: 'new-cid', email: 'u@clockify.me', name: 'User' }),
      );

      await service.setCredentials(1, { apiKey: 'new-key' });

      expect(usersService.updateClockify).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ clockifyWorkspaceId: null }),
      );
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

  describe('getUserClockifyId error paths', () => {
    it('throws BadRequestException when clockifyApiKey is null', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ clockifyApiKey: null }),
      );

      await expect(service.getActiveEntry(1, 'ws-456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when clockifyUserId is not set', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ clockifyUserId: null }),
      );

      await expect(service.getActiveEntry(1, 'ws-456')).rejects.toThrow(
        'Clockify user ID not set',
      );
    });

    it('throws ForbiddenException when workspaceId does not match', async () => {
      usersService.findOne.mockResolvedValue(
        makeUser({ clockifyWorkspaceId: 'ws-other' }),
      );

      await expect(service.getActiveEntry(1, 'ws-456')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('request() error body parsing', () => {
    it('falls back to a generic message when the error body has no message', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      mockFetch.mockResolvedValue(makeErrorResponse(500));

      await expect(service.getWorkspaces(1)).rejects.toThrow(
        'Clockify API error',
      );
    });

    it('falls back to a generic message when the error body is not valid JSON', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      mockFetch.mockResolvedValue(
        Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.reject(new Error('not json')),
        } as unknown as Response),
      );

      await expect(service.getWorkspaces(1)).rejects.toThrow(
        'Clockify API error',
      );
    });
  });

  describe('request() outgoing call construction', () => {
    it('sends Content-Type and a JSON body when the request has a body', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'e1' }), { status: 200 }),
      );
      usersService.findOne.mockResolvedValue(makeUser());

      // Empty dto — also exercises the `dto.description ?? ''` default branch.
      await service.startEntry(1, 'ws-456', {});

      const [, init] = fetchSpy.mock.calls[0];
      expect(init).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }) as Record<string, string>,
      });
      expect(JSON.parse(init?.body as string)).toEqual({
        description: '',
        tagIds: [],
        start: expect.any(String) as string,
        billable: false,
      });
    });

    it('sends no Content-Type or body for a bodyless request', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 }),
      );
      usersService.findOne.mockResolvedValue(makeUser());

      await service.getWorkspaces(1);

      const [, init] = fetchSpy.mock.calls[0];
      expect(init?.body).toBeUndefined();
      expect(
        (init?.headers as Record<string, string>)['Content-Type'],
      ).toBeUndefined();
    });

    it('returns undefined for a 204 No Content response', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));
      usersService.findOne.mockResolvedValue(makeUser());

      await expect(
        service.deleteEntry(1, 'ws-456', 'entry-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('setWorkspace', () => {
    it('updates the stored workspace id', async () => {
      await service.setWorkspace(1, 'ws-new');

      expect(usersService.updateClockify).toHaveBeenCalledWith(1, {
        clockifyWorkspaceId: 'ws-new',
      });
    });
  });

  describe('getProjects', () => {
    it('returns projects for the workspace', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const projects = [{ id: 'p1', name: 'Website' }];
      mockFetch.mockResolvedValue(makeOkResponse(projects));

      const result = await service.getProjects(1, 'ws-456');

      expect(result).toEqual(projects);
    });
  });

  describe('getActiveEntry', () => {
    it('returns the first in-progress entry', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const entry = { id: 'e1', description: 'Active' };
      mockFetch.mockResolvedValue(makeOkResponse([entry]));

      const result = await service.getActiveEntry(1, 'ws-456');

      expect(result).toEqual(entry);
    });

    it('returns null when nothing is in progress', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      mockFetch.mockResolvedValue(makeOkResponse([]));

      const result = await service.getActiveEntry(1, 'ws-456');

      expect(result).toBeNull();
    });
  });

  describe('stopEntry', () => {
    it('patches the running entry and logs audit', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const entry = { id: 'e1', description: 'Work' };
      mockFetch.mockResolvedValue(makeOkResponse(entry));

      const result = await service.stopEntry(1, 'ws-456');

      expect(result).toEqual(entry);
      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'CLOCKIFY_STOP_ENTRY',
        'clockify:ws-456/entries/e1',
      );
    });
  });

  describe('getTags / createTag', () => {
    it('returns tags for the workspace', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const tags = [{ id: 't1', name: 'billable' }];
      mockFetch.mockResolvedValue(makeOkResponse(tags));

      const result = await service.getTags(1, 'ws-456');

      expect(result).toEqual(tags);
    });

    it('creates a tag with the given name', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const tag = { id: 't2', name: 'urgent' };
      mockFetch.mockResolvedValue(makeOkResponse(tag));

      const result = await service.createTag(1, 'ws-456', 'urgent');

      expect(result).toEqual(tag);
    });
  });

  describe('updateEntry', () => {
    it('puts the updated fields and logs audit', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const entry = { id: 'e1', description: 'Updated' };
      mockFetch.mockResolvedValue(makeOkResponse(entry));

      const result = await service.updateEntry(1, 'ws-456', 'e1', {
        start: '2024-01-01T00:00:00Z',
        description: 'Updated',
        billable: true,
        tagIds: [],
      });

      expect(result).toEqual(entry);
      expect(auditService.log).toHaveBeenCalledWith(
        1,
        'CLOCKIFY_UPDATE_ENTRY',
        'clockify:ws-456/entries/e1',
      );
    });

    it('includes end when given and defaults description when omitted', async () => {
      const fetchSpy = invokeRealFetch();
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'e1' }), { status: 200 }),
      );
      usersService.findOne.mockResolvedValue(makeUser());

      await service.updateEntry(1, 'ws-456', 'e1', {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-01T01:00:00Z',
        billable: true,
        tagIds: [],
      });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init?.body as string) as Record<string, unknown>;
      expect(body.end).toBe('2024-01-01T01:00:00Z');
      expect(body.description).toBe('');
    });
  });

  describe('getEntries pagination', () => {
    it('follows pagination across a full page and stops on a short page', async () => {
      usersService.findOne.mockResolvedValue(makeUser());
      const fullPage = Array.from({ length: 50 }, (_, i) => ({
        id: `e${i}`,
        description: 'Work',
        billable: true,
        timeInterval: { start: 'S', end: 'E', duration: null },
      }));
      const shortPage = [
        {
          id: 'e-last',
          description: 'Work',
          billable: true,
          timeInterval: { start: 'S', end: 'E', duration: null },
        },
      ];
      mockFetch
        .mockResolvedValueOnce(makeOkResponse(fullPage))
        .mockResolvedValueOnce(makeOkResponse(shortPage));

      const result = await service.getEntries(1, 'ws-456');

      expect(result).toHaveLength(51);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
