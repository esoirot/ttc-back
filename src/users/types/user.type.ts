export type UserModel = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  twoFactorEnabled: boolean;
  clockifyApiKey?: string | null;
  clockifyUserId?: string | null;
  clockifyWorkspaceId?: string | null;
  hubspotAccessToken?: string | null;
  hubspotRefreshToken?: string | null;
  hubspotTokenExpiresAt?: Date | null;
  hubspotPortalId?: string | null;
  projects?: {
    id: number;
    title: string;
    description: string | null;
    userId: number | null;
  }[];
};
