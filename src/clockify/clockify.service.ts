import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { TimeEntriesService } from '../time-entries/time-entries.service.js';
import { fetchWithRetry } from '../common/retry.util.js';
import type { ClockifyWorkspace } from './types/clockify-workspace.type.js';
import type { ClockifyProject } from './types/clockify-project.type.js';
import type { ClockifyTimeEntry } from './types/time-entry.type.js';
import type { ClockifyTag } from './types/clockify-tag.type.js';
import type { SetCredentialsDto } from './dto/set-credentials.dto.js';
import type { StartTimeEntryDto } from './dto/start-time-entry.dto.js';
import type { UpdateTimeEntryDto } from './dto/update-time-entry.dto.js';
import type { ImportEntriesDto } from './dto/import-entries.dto.js';

type ClockifyUser = { id: string; email: string; name: string };

type FetchErrorBody = { message?: string };

@Injectable()
export class ClockifyService {
  private readonly baseUrl: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly config: ConfigService,
    private readonly timeEntriesService: TimeEntriesService,
  ) {
    this.baseUrl =
      this.config.get<string>('CLOCKIFY_API_URL') ??
      'https://api.clockify.me/api/v1';
  }

  private async request<T>(
    apiKey: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const hasBody = body !== undefined;
    const res = await fetchWithRetry((signal) =>
      fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'X-Api-Key': apiKey,
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
        signal,
      }),
    );

    if (!res.ok) {
      const raw: unknown = await res.json().catch(() => ({}));
      const msg =
        raw !== null &&
        typeof raw === 'object' &&
        'message' in raw &&
        typeof (raw as FetchErrorBody).message === 'string'
          ? (raw as FetchErrorBody).message
          : 'Clockify API error';
      throw new HttpException(msg ?? 'Clockify API error', res.status);
    }

    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  }

  private async getUserApiKey(
    userId: number,
    workspaceId?: string,
  ): Promise<string> {
    const user = await this.usersService.findOne(userId);
    if (!user.clockifyApiKey) {
      throw new BadRequestException('No Clockify API key configured');
    }
    if (workspaceId !== undefined && user.clockifyWorkspaceId !== workspaceId) {
      throw new ForbiddenException('Clockify workspace not owned by this user');
    }
    return user.clockifyApiKey;
  }

  private async getUserClockifyId(
    userId: number,
    workspaceId?: string,
  ): Promise<{ apiKey: string; clockifyUserId: string }> {
    const user = await this.usersService.findOne(userId);
    if (!user.clockifyApiKey) {
      throw new BadRequestException('No Clockify API key configured');
    }
    if (!user.clockifyUserId) {
      throw new BadRequestException(
        'Clockify user ID not set — re-save credentials',
      );
    }
    if (workspaceId !== undefined && user.clockifyWorkspaceId !== workspaceId) {
      throw new ForbiddenException('Clockify workspace not owned by this user');
    }
    return { apiKey: user.clockifyApiKey, clockifyUserId: user.clockifyUserId };
  }

  async setWorkspace(userId: number, workspaceId: string): Promise<void> {
    await this.usersService.updateClockify(userId, {
      clockifyWorkspaceId: workspaceId,
    });
  }

  async getStatus(
    userId: number,
  ): Promise<{ connected: boolean; workspaceId: string | null }> {
    const user = await this.usersService.findOne(userId);
    return {
      connected: !!user.clockifyApiKey,
      workspaceId: user.clockifyWorkspaceId ?? null,
    };
  }

  async clearCredentials(userId: number): Promise<void> {
    await this.usersService.updateClockify(userId, {
      clockifyApiKey: null,
      clockifyUserId: null,
      clockifyWorkspaceId: null,
    });
    this.auditService.log(userId, 'CLOCKIFY_DISCONNECT', 'clockify');
  }

  async setCredentials(userId: number, dto: SetCredentialsDto): Promise<void> {
    const clockifyUser = await this.request<ClockifyUser>(
      dto.apiKey,
      'GET',
      '/user',
    );
    await this.usersService.updateClockify(userId, {
      clockifyApiKey: dto.apiKey,
      clockifyUserId: clockifyUser.id,
      clockifyWorkspaceId: dto.workspaceId ?? null,
    });
  }

  async getWorkspaces(userId: number): Promise<ClockifyWorkspace[]> {
    const apiKey = await this.getUserApiKey(userId);
    return this.request<ClockifyWorkspace[]>(apiKey, 'GET', '/workspaces');
  }

  async getProjects(
    userId: number,
    workspaceId: string,
  ): Promise<ClockifyProject[]> {
    const apiKey = await this.getUserApiKey(userId, workspaceId);
    return this.request<ClockifyProject[]>(
      apiKey,
      'GET',
      `/workspaces/${workspaceId}/projects`,
    );
  }

  async getEntries(
    userId: number,
    workspaceId: string,
    start?: string,
    end?: string,
  ): Promise<ClockifyTimeEntry[]> {
    const { apiKey, clockifyUserId } = await this.getUserClockifyId(
      userId,
      workspaceId,
    );
    const all: ClockifyTimeEntry[] = [];
    const PAGE_SIZE = 50;
    let page = 1;
    while (true) {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      params.set('page', String(page));
      params.set('page-size', String(PAGE_SIZE));
      const entries = await this.request<ClockifyTimeEntry[]>(
        apiKey,
        'GET',
        `/workspaces/${workspaceId}/user/${clockifyUserId}/time-entries?${params.toString()}`,
      );
      if (entries.length === 0) break;
      all.push(...entries);
      if (entries.length < PAGE_SIZE) break;
      page++;
    }
    return all;
  }

  async getActiveEntry(
    userId: number,
    workspaceId: string,
  ): Promise<ClockifyTimeEntry | null> {
    const { apiKey, clockifyUserId } = await this.getUserClockifyId(
      userId,
      workspaceId,
    );
    const entries = await this.request<ClockifyTimeEntry[]>(
      apiKey,
      'GET',
      `/workspaces/${workspaceId}/user/${clockifyUserId}/time-entries?in-progress=true`,
    );
    return entries[0] ?? null;
  }

  async startEntry(
    userId: number,
    workspaceId: string,
    dto: StartTimeEntryDto,
  ): Promise<ClockifyTimeEntry> {
    const apiKey = await this.getUserApiKey(userId, workspaceId);
    const result = await this.request<ClockifyTimeEntry>(
      apiKey,
      'POST',
      `/workspaces/${workspaceId}/time-entries`,
      {
        description: dto.description ?? '',
        projectId: dto.projectId,
        tagIds: dto.tagIds ?? [],
        start: dto.start ?? new Date().toISOString(),
        billable: dto.billable ?? false,
      },
    );
    this.auditService.log(
      userId,
      'CLOCKIFY_START_ENTRY',
      `clockify:${workspaceId}/entries/${result.id}`,
    );
    return result;
  }

  async stopEntry(
    userId: number,
    workspaceId: string,
  ): Promise<ClockifyTimeEntry> {
    const { apiKey, clockifyUserId } = await this.getUserClockifyId(
      userId,
      workspaceId,
    );
    const result = await this.request<ClockifyTimeEntry>(
      apiKey,
      'PATCH',
      `/workspaces/${workspaceId}/user/${clockifyUserId}/time-entries`,
      { end: new Date().toISOString() },
    );
    this.auditService.log(
      userId,
      'CLOCKIFY_STOP_ENTRY',
      `clockify:${workspaceId}/entries/${result.id}`,
    );
    return result;
  }

  async deleteEntry(
    userId: number,
    workspaceId: string,
    entryId: string,
  ): Promise<void> {
    const apiKey = await this.getUserApiKey(userId, workspaceId);
    await this.request<void>(
      apiKey,
      'DELETE',
      `/workspaces/${workspaceId}/time-entries/${entryId}`,
    );
    this.auditService.log(
      userId,
      'CLOCKIFY_DELETE_ENTRY',
      `clockify:${workspaceId}/entries/${entryId}`,
    );
  }

  async getTags(userId: number, workspaceId: string): Promise<ClockifyTag[]> {
    const apiKey = await this.getUserApiKey(userId, workspaceId);
    return this.request<ClockifyTag[]>(
      apiKey,
      'GET',
      `/workspaces/${workspaceId}/tags`,
    );
  }

  async createTag(
    userId: number,
    workspaceId: string,
    name: string,
  ): Promise<ClockifyTag> {
    const apiKey = await this.getUserApiKey(userId, workspaceId);
    return this.request<ClockifyTag>(
      apiKey,
      'POST',
      `/workspaces/${workspaceId}/tags`,
      {
        name,
      },
    );
  }

  async importEntries(
    userId: number,
    workspaceId: string,
    dto: ImportEntriesDto,
  ): Promise<{ imported: number; skipped: number }> {
    const entries = await this.getEntries(
      userId,
      workspaceId,
      dto.start,
      dto.end,
    );
    type CompletedEntry = ClockifyTimeEntry & {
      timeInterval: { start: string; end: string; duration: string | null };
    };
    const completed = entries.filter(
      (e): e is CompletedEntry => e.timeInterval.end !== null,
    );
    const mapped = completed.map((e) => ({
      id: e.id,
      description: e.description,
      start: e.timeInterval.start,
      end: e.timeInterval.end,
      billable: e.billable,
    }));
    const result = await this.timeEntriesService.importEntries(userId, mapped);
    this.auditService.log(
      userId,
      'CLOCKIFY_IMPORT_ENTRIES',
      `clockify:${workspaceId}`,
      { ...result, start: dto.start, end: dto.end },
    );
    return result;
  }

  async updateEntry(
    userId: number,
    workspaceId: string,
    entryId: string,
    dto: UpdateTimeEntryDto,
  ): Promise<ClockifyTimeEntry> {
    const apiKey = await this.getUserApiKey(userId, workspaceId);
    const result = await this.request<ClockifyTimeEntry>(
      apiKey,
      'PUT',
      `/workspaces/${workspaceId}/time-entries/${entryId}`,
      {
        start: dto.start,
        ...(dto.end !== undefined ? { end: dto.end } : {}),
        description: dto.description ?? '',
        projectId: dto.projectId ?? null,
        billable: dto.billable,
        tagIds: dto.tagIds,
        customFieldValues: [],
      },
    );
    this.auditService.log(
      userId,
      'CLOCKIFY_UPDATE_ENTRY',
      `clockify:${workspaceId}/entries/${entryId}`,
    );
    return result;
  }
}
