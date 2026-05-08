import { CreateUserInput } from '../dto/create-user.input';
import { UpdateUserInput } from '../dto/update-user.input';
import { UserModel } from '../types/user.type';

export type ClockifyUpdate = {
  clockifyApiKey?: string | null;
  clockifyUserId?: string | null;
  clockifyWorkspaceId?: string | null;
};

export type HubspotUpdate = {
  hubspotAccessToken?: string | null;
  hubspotRefreshToken?: string | null;
  hubspotTokenExpiresAt?: Date | null;
  hubspotPortalId?: string | null;
};

export abstract class UserRepository {
  abstract findById(id: number): Promise<UserModel>;
  abstract findAll(): Promise<UserModel[]>;
  abstract create(data: CreateUserInput): Promise<UserModel>;
  abstract update(id: number, data: UpdateUserInput): Promise<UserModel>;
  abstract updateClockify(id: number, data: ClockifyUpdate): Promise<UserModel>;
  abstract updateHubspot(id: number, data: HubspotUpdate): Promise<UserModel>;
  abstract delete(id: number): Promise<UserModel>;
}
