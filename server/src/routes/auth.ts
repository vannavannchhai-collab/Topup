import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db/index.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { uuid, nowIso } from '../lib/ids.js';
import { getWallet } from '../lib/payments.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';
import type { TransactionRow, UserRow, WalletRow } from '../types.js';

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registration = credentials.extend({
  name: z.string().min(2, 'Tell us your name').max(60),
  phone: z.string().max(20).optional(),
  locale: z.enum(['km', 'en']).default('km'),
  demoFunds: z.boolean().default(false),
});

function publicUser(user: UserRow, wallet: WalletRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    locale: user.locale,
    phone: user.phone,
    createdAt: user.created_at,
    wallet: {
      balanceCents: wallet.balance_cents,
      currency: wallet.currency,
      points: wallet.points,
    },
  };
}

authRouter.post(
  '/register',
  rateLimit(10, 60_000),
  asyncHandler(async (req, res) => {
    const body = parse(registration, req.body);
    const email = body.email.toLowerCase().trim();

    if (q.get('SELECT id FROM users WHERE email = ?', email)) {
      throw ApiError.conflict('An account with that email already exists');
    }

    const user: UserRow = {
      id: uuid(),
      email,
      name: body.name.trim(),
      role: 'customer',
      locale: body.locale,
      phone: body.phone ?? null,
      created_at: nowIso(),
    };

    q.run(
      'INSERT INTO users (id, email, password_hash, name, role, phone, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      user.id,
      user.email,
      await hashPassword(body.password),
      user.name,
      user.role,
      user.phone,
      user.locale,
      user.created_at,
    );

    const wallet = getWallet(user.id);
    // Demo mode seeds a small starting balance so the storefront is explorable.
    if (config.features.demoMode && body.demoFunds) {
      q.run('UPDATE wallets SET balance_cents = 5000, updated_at = ? WHERE user_id = ?', nowIso(), user.id);
      wallet.balance_cents = 5000;
      q.run(
        `INSERT INTO transactions (id, user_id, type, amount_cents, balance_after_cents, reference, description, created_at)
         VALUES (?, ?, 'deposit', 5000, 5000, ?, 'Welcome credit', ?)`,
        uuid(),
        user.id,
        'WELCOME',
        nowIso(),
      );
    }

    log.info('user registered', { id: user.id, email: user.email });
    res.status(201).json({
      token: signToken({ sub: user.id, email: user.email, role: user.role }),
      user: publicUser(user, wallet),
    });
  }),
);

authRouter.post(
  '/login',
  rateLimit(15, 60_000),
  asyncHandler(async (req, res) => {
    const body = parse(credentials, req.body);
    const email = body.email.toLowerCase().trim();
    const record = q.get<UserRow & { password_hash: string }>('SELECT * FROM users WHERE email = ?', email);
    if (!record || !(await verifyPassword(body.password, record.password_hash))) {
      throw ApiError.unauthorized('Email or password is incorrect');
    }
    const wallet = getWallet(record.id);
    res.json({
      token: signToken({ sub: record.id, email: record.email, role: record.role }),
      user: publicUser(record, wallet),
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = q.get<UserRow>('SELECT * FROM users WHERE id = ?', req.user!.id)!;
    const wallet = getWallet(user.id);
    const recent = q.all<TransactionRow>(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      user.id,
    );
    res.json({
      user: publicUser(user, wallet),
      recentTransactions: recent.map((row) => ({
        id: row.id,
        type: row.type,
        amountCents: row.amount_cents,
        balanceAfterCents: row.balance_after_cents,
        description: row.description,
        createdAt: row.created_at,
      })),
    });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(2).max(60).optional(),
        locale: z.enum(['km', 'en']).optional(),
        phone: z.string().max(20).nullable().optional(),
      }),
      req.body,
    );
    if (body.name) q.run('UPDATE users SET name = ? WHERE id = ?', body.name, req.user!.id);
    if (body.locale) q.run('UPDATE users SET locale = ? WHERE id = ?', body.locale, req.user!.id);
    if (body.phone !== undefined) q.run('UPDATE users SET phone = ? WHERE id = ?', body.phone, req.user!.id);
    const user = q.get<UserRow>('SELECT * FROM users WHERE id = ?', req.user!.id)!;
    res.json({ user: publicUser(user, getWallet(user.id)) });
  }),
);
