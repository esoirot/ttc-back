import { BadRequestException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

type SignedState = { payload: string; sig: string };

export function signOAuthState<T extends object>(
  secret: string,
  data: T,
  ttlMs: number,
): string {
  const nonce = randomBytes(16).toString('hex');
  const exp = Date.now() + ttlMs;
  const payload = JSON.stringify({ ...data, nonce, exp });
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(
    JSON.stringify({ payload, sig } satisfies SignedState),
  ).toString('base64url');
}

export function verifyOAuthState<T extends object>(
  secret: string,
  state: string,
): T & { nonce: string; exp: number } {
  let parsed: SignedState;
  try {
    parsed = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf8'),
    ) as SignedState;
  } catch {
    throw new BadRequestException('Invalid OAuth state');
  }
  const expected = createHmac('sha256', secret)
    .update(parsed.payload)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const recBuf = Buffer.from(parsed.sig, 'hex');
  if (expBuf.length !== recBuf.length || !timingSafeEqual(expBuf, recBuf)) {
    throw new BadRequestException('Invalid OAuth state signature');
  }
  const data = JSON.parse(parsed.payload) as T & {
    nonce: string;
    exp: number;
  };
  if (Date.now() > data.exp) {
    throw new BadRequestException('OAuth state expired');
  }
  return data;
}
