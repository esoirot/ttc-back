import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service.js';
import { fetchWithRetry } from '../common/retry.util.js';
import type { ClockifyWorkspace } from './types/clockify-workspace.type.js';
import type { ClockifyProject } from './types/clockify-project.type.js';
import type { ClockifyTimeEntry } from './types/time-entry.type.js';
import type { ClockifyTag } from './types/clockify-tag.type.js';
import type { SetCredentialsDto } from './dto/set-credentials.dto.js';
import type { StartTimeEntryDto } from './dto/start-time-entry.dto.js';
import type { UpdateTimeEntryDto } from './dto/update-time-entry.dto.js';

type ClockifyUser = { id: string; email: string; name: string };

type FetchErrorBody = { message?: string };

@Injectable()
export class ClockifyService {
  private readonly baseUrl: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
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
    const res = await fetchWithRetry(() =>
      fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'X-Api-Key': apiKey,
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
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

  private async getUserApiKey(userId: number): Promise<string> {
    const user = await this.usersService.findOne(userId);
    if (!user.clockifyApiKey) {
      throw new BadRequestException('No Clockify API key configured');
    }
    return user.clockifyApiKey;
  }

  private async getUserClockifyId(
    userId: number,
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
    const apiKey = await this.getUserApiKey(userId);
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
    const { apiKey, clockifyUserId } = await this.getUserClockifyId(userId);
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const qs = params.size > 0 ? `?${params.toString()}` : '';
    return this.request<ClockifyTimeEntry[]>(
      apiKey,
      'GET',
      `/workspaces/${workspaceId}/user/${clockifyUserId}/time-entries${qs}`,
    );
  }

  async getActiveEntry(
    userId: number,
    workspaceId: string,
  ): Promise<ClockifyTimeEntry | null> {
    const { apiKey, clockifyUserId } = await this.getUserClockifyId(userId);
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
    const apiKey = await this.getUserApiKey(userId);
    return this.request<ClockifyTimeEntry>(
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
  }

  async stopEntry(
    userId: number,
    workspaceId: string,
  ): Promise<ClockifyTimeEntry> {
    const { apiKey, clockifyUserId } = await this.getUserClockifyId(userId);
    return this.request<ClockifyTimeEntry>(
      apiKey,
      'PATCH',
      `/workspaces/${workspaceId}/user/${clockifyUserId}/time-entries`,
      { end: new Date().toISOString() },
    );
  }

  async deleteEntry(
    userId: number,
    workspaceId: string,
    entryId: string,
  ): Promise<void> {
    const apiKey = await this.getUserApiKey(userId);
    await this.request<void>(
      apiKey,
      'DELETE',
      `/workspaces/${workspaceId}/time-entries/${entryId}`,
    );
  }

  async getTags(userId: number, workspaceId: string): Promise<ClockifyTag[]> {
    const apiKey = await this.getUserApiKey(userId);
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
    const apiKey = await this.getUserApiKey(userId);
    return this.request<ClockifyTag>(
      apiKey,
      'POST',
      `/workspaces/${workspaceId}/tags`,
      {
        name,
      },
    );
  }

  async updateEntry(
    userId: number,
    workspaceId: string,
    entryId: string,
    dto: UpdateTimeEntryDto,
  ): Promise<ClockifyTimeEntry> {
    const apiKey = await this.getUserApiKey(userId);
    return this.request<ClockifyTimeEntry>(
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
      },
    );
  }
}
