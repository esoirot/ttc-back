export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  password: string | null;
  role: string;
  adminPermissions: string[];
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean;
};
