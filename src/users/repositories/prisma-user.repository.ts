import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UserRepository,
  type ClockifyUpdate,
  type HubspotUpdate,
} from './users.repository';
import { PrismaService } from '../../prisma.service';
import { UserModel } from '../types/user.type';
import { CreateUserInput } from '../dto/create-user.input';
import { UpdateUserInput } from '../dto/update-user.input';
import { encrypt, decrypt } from '../../common/crypto.util';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  private readonly encKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.encKey = this.config.getOrThrow<string>('APP_ENCRYPTION_KEY');
  }

  private encryptField(
    val: string | null | undefined,
  ): string | null | undefined {
    if (val == null || !this.encKey) return val;
    return encrypt(val, this.encKey);
  }

  private decryptField(
    val: string | null | undefined,
  ): string | null | undefined {
    if (val == null || !this.encKey) return val;
    try {
      return decrypt(val, this.encKey);
    } catch {
      return val;
    }
  }

  private decryptUser(user: UserModel): UserModel {
    return {
      ...user,
      clockifyApiKey: this.decryptField(user.clockifyApiKey),
      hubspotAccessToken: this.decryptField(user.hubspotAccessToken),
      hubspotRefreshToken: this.decryptField(user.hubspotRefreshToken),
    };
  }

  async findById(id: number): Promise<UserModel> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return this.decryptUser(user);
  }

  async findAll(): Promise<UserModel[]> {
    const users = await this.prisma.user.findMany();
    return users.map((u) => this.decryptUser(u));
  }

  async create(data: CreateUserInput): Promise<UserModel> {
    return this.prisma.user.create({
      data,
    });
  }

  async update(id: number, data: UpdateUserInput): Promise<UserModel> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }

  async updateClockify(id: number, data: ClockifyUpdate): Promise<UserModel> {
    try {
      const encrypted: ClockifyUpdate = {
        ...data,
        clockifyApiKey: this.encryptField(data.clockifyApiKey),
      };
      return await this.prisma.user.update({
        where: { id },
        data: encrypted,
      });
    } catch {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }

  async updateHubspot(id: number, data: HubspotUpdate): Promise<UserModel> {
    try {
      const encrypted: HubspotUpdate = {
        ...data,
        hubspotAccessToken: this.encryptField(data.hubspotAccessToken),
        hubspotRefreshToken: this.encryptField(data.hubspotRefreshToken),
      };
      return await this.prisma.user.update({
        where: { id },
        data: encrypted,
      });
    } catch {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }

  async delete(id: number): Promise<UserModel> {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }
}
