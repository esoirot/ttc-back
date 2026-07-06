export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  adminPermissions: string[];
  type: 'access' | 'temp';
  jti?: string;
}
