import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64url');

const sign = (data: string): string =>
  createHmac('sha256', config.jwtSecret).update(data).digest('base64url');

/** Minimal, dependency-free HS256 JWT encoder. */
export function signToken(
  claims: Omit<TokenPayload, 'iat' | 'exp'>,
  ttlSeconds = config.jwtTtlSeconds,
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { ...claims, iat: issuedAt, exp: issuedAt + ttlSeconds };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.${sign(`${header}.${body}`)}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.sub || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
