import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db/index.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { getWallet, postLedger } from '../lib/payments.js';
import { uuid, nowIso, reference } from '../lib/ids.js';
import type { TransactionRow } from '../types.js';

export const walletRouter = Router();

const DEPOSIT_METHODS = [
  { id: 'aba', nameEn: 'ABA Bank', nameKm: 'ធនាគារ ABA', fee: 0 },
  { id: 'acleda', nameEn: 'ACLEDA', nameKm: 'អេស៊ីលីដា', fee: 0 },
  { id: 'bakong', nameEn: 'Bakong', nameKm: 'បាគង', fee: 0 },
  { id: 'wing', nameEn: 'Wing', nameKm: 'វីង', fee: 100 },
  { id: 'card', nameEn: 'Visa / Mastercard', nameKm: 'វីសា / ម៉ាស្ទ័រកាត', fee: 150 },
] as const;

walletRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const wallet = getWallet(req.user!.id);
    const totals = q.get<{ credits: number; debits: number; count: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS credits,
         COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0) AS debits,
         COUNT(*) AS count
       FROM transactions WHERE user_id = ?`,
      req.user!.id,
    );
    res.json({
      balanceCents: wallet.balance_cents,
      currency: wallet.currency,
      points: wallet.points,
      pointsValueCents: wallet.points,
      lifetimeInCents: totals?.credits ?? 0,
      lifetimeOutCents: totals?.debits ?? 0,
      transactionCount: totals?.count ?? 0,
      depositMethods: DEPOSIT_METHODS,
    });
  }),
);

walletRouter.get(
  '/transactions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Number(req.query.limit ?? 30));
    const rows = q.all<TransactionRow>(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      req.user!.id,
      limit,
    );
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        amountCents: row.amount_cents,
        balanceAfterCents: row.balance_after_cents,
        reference: row.reference,
        description: row.description,
        createdAt: row.created_at,
      })),
    });
  }),
);

walletRouter.post(
  '/deposit',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        amountCents: z.number().int().min(100).max(5_000_00),
        method: z.enum(['aba', 'acleda', 'bakong', 'wing', 'card']).default('bakong'),
        // In production the PSP webhook supplies a signature; demo accepts a token.
        idempotencyKey: z.string().min(8).max(64).optional(),
      }),
      req.body,
    );

    const method = DEPOSIT_METHODS.find((entry) => entry.id === body.method)!;
    const fee = method.fee;
    const netCents = body.amountCents - fee;
    if (netCents <= 0) throw ApiError.badRequest('Amount is too small after fees');

    const ref = reference('DEP');
    const wallet = postLedger(
      req.user!.id,
      'deposit',
      netCents,
      `Top-up via ${method.nameEn}${fee ? ` (fee $${(fee / 100).toFixed(2)})` : ''}`,
      ref,
    );

    q.run(
      'INSERT INTO events (id, user_id, name, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      uuid(),
      req.user!.id,
      'wallet_deposit',
      JSON.stringify({ amountCents: netCents, method: method.id }),
      nowIso(),
    );

    res.status(201).json({
      reference: ref,
      balanceCents: wallet.balance_cents,
      creditedCents: netCents,
      feeCents: fee,
      method: method.id,
    });
  }),
);

walletRouter.post(
  '/redeem-points',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ points: z.number().int().min(100).max(100_000) }), req.body);
    const wallet = getWallet(req.user!.id);
    if (wallet.points < body.points) throw ApiError.badRequest('You do not have that many points');

    // 100 points = $1 → 1 point = 1 cent
    const creditCents = body.points;
    const updated = q.transaction(() => {
      q.run('UPDATE wallets SET points = points - ? WHERE user_id = ?', body.points, req.user!.id);
      return postLedger(req.user!.id, 'points_redeem', creditCents, `Redeemed ${body.points} NOVA points`, reference('PTS'));
    });

    res.json({
      creditedCents: creditCents,
      balanceCents: updated.balance_cents,
      pointsRemaining: Math.max(0, wallet.points - body.points),
    });
  }),
);
