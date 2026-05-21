import { CreateTimeEntryInput } from '../dto/create-time-entry.input';
import { StartTimerInput } from '../dto/start-timer.input';
import { UpdateTimeEntryInput } from '../dto/update-time-entry.input';
import { TimeEntryModel } from '../types/time-entry.type';

export interface TimeEntryConnectionModel {
  items: TimeEntryModel[];
  nextCursor: number | null;
  total: number;
}

type PaginationArgs = { limit?: number; cursor?: number };

export abstract class TimeEntryRepository {
  abstract findById(id: number, userId: number): Promise<TimeEntryModel>;
  abstract existsByClockifyEntryId(
    userId: number,
    clockifyEntryId: string,
  ): Promise<boolean>;
  abstract findAll(
    userId: number,
    filters: {
      projectId?: number;
      projectIds?: number[];
      start?: Date;
      end?: Date;
    },
    pagination?: PaginationArgs,
  ): Promise<TimeEntryConnectionModel>;
  abstract findActive(userId: number): Promise<TimeEntryModel | null>;
  abstract create(
    userId: number,
    data: CreateTimeEntryInput,
  ): Promise<TimeEntryModel>;
  abstract startTimer(
    userId: number,
    data: StartTimerInput,
  ): Promise<TimeEntryModel>;
  abstract stopTimer(userId: number): Promise<TimeEntryModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateTimeEntryInput,
  ): Promise<TimeEntryModel>;
  abstract delete(id: number, userId: number): Promise<TimeEntryModel>;
}
