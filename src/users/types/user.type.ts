import { ProjectModel } from '../../projects/types/project.type';

export type UserModel = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  createdAt?: Date;
  twoFactorEnabled: boolean;
  clockifyApiKey?: string | null;
  clockifyUserId?: string | null;
  clockifyWorkspaceId?: string | null;
  hubspotAccessToken?: string | null;
  hubspotRefreshToken?: string | null;
  hubspotTokenExpiresAt?: Date | null;
  hubspotPortalId?: string | null;
  logoUrl?: string | null;
  adminPermissions?: string[];
  projects?: ProjectModel[];
};
