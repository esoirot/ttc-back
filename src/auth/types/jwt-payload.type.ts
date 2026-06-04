export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  type: 'access' | 'temp';
  jti?: string;
}
