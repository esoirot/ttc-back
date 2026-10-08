import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decrypt, encrypt } from '../../common/crypto.util';
import { Prisma8Service } from '../../prisma8/prisma8.service';
import { fromDb, nowDb, toDb } from '../../prisma8/timestamp';
import { CreateUserInput } from '../dto/create-user.input';
import { UpdateUserInput } from '../dto/update-user.input';
import { UserModel } from '../types/user.type';
import {
  type ClockifyUpdate,
  type GoogleCalendarUpdate,
  type HubspotUpdate,
  UserRepository,
} from './users.repository';

type Row = NonNullable<
  Awaited<ReturnType<Prisma8Service['orm']['public']['User']['first']>>
>;

const CREDENTIALS = [
  'clockifyApiKey',
  'hubspotAccessToken',
  'hubspotRefreshToken',
  'googleCalendarAccessToken',
  'googleCalendarRefreshToken',
] as const;

@Injectable()
export class Prisma8UserRepository implements UserRepository {
  private readonly encKey: string;

  constructor(
    private readonly db: Prisma8Service,
    private readonly config: ConfigService,
  ) {
    this.encKey = this.config.getOrThrow<string>('APP_ENCRYPTION_KEY');
  }

  private get users() {
    return this.db.orm.public.User;
  }

  private encryptField(
    val: string | null | undefined,
  ): string | null | undefined {
    if (val == null) return val;
    return encrypt(val, this.encKey);
  }

  private decryptField(
    val: string | null | undefined,
  ): string | null | undefined {
    if (val == null) return val;
    try {
      return decrypt(val, this.encKey);
    } catch {
      return val;
    }
  }

  /** Dates back to Date, third-party credentials decrypted. */
  private toModel(row: Row): UserModel {
    const user: UserModel = {
      ...row,
      adminPermissions: [...(row.adminPermissions ?? [])],
      createdAt: fromDb(row.createdAt),
      hubspotTokenExpiresAt: fromDb(row.hubspotTokenExpiresAt),
      googleCalendarTokenExpiresAt: fromDb(row.googleCalendarTokenExpiresAt),
    };
    for (const field of CREDENTIALS)
      user[field] = this.decryptField(user[field]);
    return { ...user, updatedAt: fromDb(row.updatedAt) } as UserModel;
  }

  private async write(
    id: number,
    data: Parameters<
      ReturnType<Prisma8Service['orm']['public']['User']['where']>['update']
    >[0],
  ) {
    const row = await this.users
      .where({ id })
      .update({ ...data, updatedAt: nowDb() });
    if (!row) throw new NotFoundException(`User with id ${id} not found`);
    return this.toModel(row);
  }

  async findById(id: number): Promise<UserModel> {
    const user = await this.users.first({ id });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return this.toModel(user);
  }

  async findAll(): Promise<UserModel[]> {
    const rows = await this.users.all();
    return rows.map((u) => this.toModel(u));
  }

  async create(data: CreateUserInput): Promise<UserModel> {
    return this.toModel(
      await this.users.create({ ...data, updatedAt: nowDb() }),
    );
  }

  update(id: number, data: UpdateUserInput): Promise<UserModel> {
    const { id: _id, ...fields } = data;
    return this.write(id, fields);
  }

  updateClockify(id: number, data: ClockifyUpdate): Promise<UserModel> {
    return this.write(id, {
      ...data,
      clockifyApiKey: this.encryptField(data.clockifyApiKey),
    });
  }

  updateHubspot(id: number, data: HubspotUpdate): Promise<UserModel> {
    return this.write(id, {
      ...data,
      hubspotTokenExpiresAt:
        data.hubspotTokenExpiresAt === undefined
          ? undefined
          : toDb(data.hubspotTokenExpiresAt),
      hubspotAccessToken: this.encryptField(data.hubspotAccessToken),
      hubspotRefreshToken: this.encryptField(data.hubspotRefreshToken),
    });
  }

  updateGoogleCalendar(
    id: number,
    data: GoogleCalendarUpdate,
  ): Promise<UserModel> {
    return this.write(id, {
      ...data,
      googleCalendarTokenExpiresAt:
        data.googleCalendarTokenExpiresAt === undefined
          ? undefined
          : toDb(data.googleCalendarTokenExpiresAt),
      googleCalendarAccessToken: this.encryptField(
        data.googleCalendarAccessToken,
      ),
      googleCalendarRefreshToken: this.encryptField(
        data.googleCalendarRefreshToken,
      ),
    });
  }

  async delete(id: number): Promise<UserModel> {
    const row = await this.users.where({ id }).delete();
    if (!row) throw new NotFoundException(`User with id ${id} not found`);
    return this.toModel(row);
  }
}
