import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { ApiError } from '../lib/http.js';
import { q } from '../db/index.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
  phone: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
  phone: string | null;
}

function loadUser(id: string): AuthUser | null {
  const row = q.get<UserRow>('SELECT id, email, name, role, locale, phone FROM users WHERE id = ?', id);
  return row ?? null;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken) return queryToken;
  return null;
}

/** Requires a valid token; attaches the fresh user record. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized());
  const payload = verifyToken(token);
  if (!payload) return next(ApiError.unauthorized('Your session expired, please sign in again'));
  const user = loadUser(payload.sub);
  if (!user) return next(ApiError.unauthorized('Account no longer exists'));
  req.user = user;
  next();
}

/** Attaches the user when a token is present, but never blocks. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  const payload = verifyToken(token);
  if (!payload) return next();
  const user = loadUser(payload.sub);
  if (user) req.user = user;
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return next(ApiError.forbidden('Admin access required'));
  next();
}
