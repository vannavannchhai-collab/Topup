import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/http.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Tiny in-memory fixed-window rate limiter. Keyed by IP + optional identity so
 * that a shared NAT does not starve individual users.
 */
export function rateLimit(max: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [key, bucket] of buckets) if (bucket.resetAt < now) buckets.delete(key);
    }
    const identity = (req as Request & { user?: { id: string } }).user?.id;
    const key = `${req.ip ?? 'unknown'}:${identity ?? 'anon'}:${req.baseUrl}${req.path.split('/')[1] ?? ''}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      next(new ApiError(429, 'rate_limited', `Too many requests. Retry in ${retryAfter}s.`));
      return;
    }
    next();
  };
}
