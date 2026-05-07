export type UserModel = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  twoFactorEnabled: boolean;
  projects?: {
    id: number;
    title: string;
    description: string | null;
    userId: number | null;
  }[];
};
