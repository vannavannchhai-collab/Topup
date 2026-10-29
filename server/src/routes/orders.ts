import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db/index.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { purchase, serializeOrder } from '../lib/payments.js';
import { assessRisk } from '../ai/risk.js';
import { getProduct, serializeProduct } from '../ai/catalog.js';
import { createHash } from 'node:crypto';

export const ordersRouter = Router();

ordersRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        productId: z.string().min(3),
        recipient: z.string().min(8).max(20),
        quantity: z.number().int().min(1).max(100).default(1),
        channel: z.enum(['web', 'assistant', 'sms', 'api']).default('web'),
        idempotencyKey: z.string().min(8).max(80).optional(),
      }),
      req.body,
    );

    // Idempotency: the same key from the same user replays the original order.
    const idempotencyKey = body.idempotencyKey
      ? createHash('sha256').update(body.idempotencyKey).digest('hex').slice(0, 40)
      : null;
    if (idempotencyKey) {
      const existing = q.get<{ id: string }>(
        'SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ?',
        req.user!.id,
        idempotencyKey,
      );
      if (existing) {
        const row = q.get<Record<string, unknown>>(
          `SELECT o.*, p.name_en AS product_name_en, p.name_km AS product_name_km
           FROM orders o JOIN products p ON p.id = o.product_id WHERE o.id = ?`,
          existing.id,
        )!;
        res.json({ order: serializeOrder(row), replayed: true });
        return;
      }
    }

    const result = purchase({
      user: req.user!,
      productId: body.productId,
      recipient: body.recipient,
      quantity: body.quantity,
      channel: body.channel,
      idempotencyKey,
    });

    res.status(201).json({
      order: serializeOrder({ ...result.order }),
      productName: result.productName,
      wallet: {
        balanceCents: result.wallet.balance_cents,
        points: result.wallet.points,
      },
      risk: {
        score: result.risk.score,
        band: result.risk.band,
        decision: result.risk.decision,
        explanationEn: result.risk.explanationEn,
        explanationKm: result.risk.explanationKm,
        features: result.risk.features,
      },
    });
  }),
);

ordersRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Number(req.query.limit ?? 25));
    const rows = q.all<Record<string, unknown>>(
      `SELECT o.*, p.name_en AS product_name_en, p.name_km AS product_name_km, p.category
       FROM orders o JOIN products p ON p.id = o.product_id
       WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT ?`,
      req.user!.id,
      limit,
    );
    const summary = q.get<{ total: number; count: number }>(
      'SELECT COALESCE(SUM(amount_cents),0) AS total, COUNT(*) AS count FROM orders WHERE user_id = ?',
      req.user!.id,
    );
    res.json({
      items: rows.map((row) => ({ ...serializeOrder(row), category: row.category })),
      totals: { amountCents: summary?.total ?? 0, orders: summary?.count ?? 0 },
    });
  }),
);

ordersRouter.get(
  '/:reference',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = q.get<Record<string, unknown>>(
      `SELECT o.*, p.name_en AS product_name_en, p.name_km AS product_name_km, p.category, p.data_gb
       FROM orders o JOIN products p ON p.id = o.product_id
       WHERE (o.reference = ? OR o.id = ?) AND o.user_id = ?`,
      String(req.params.reference),
      String(req.params.reference),
      req.user!.id,
    );
    if (!row) throw ApiError.notFound('Order not found');
    res.json({ order: { ...serializeOrder(row), category: row.category, dataGb: row.data_gb } });
  }),
);

/** Pre-flight risk check used by the checkout drawer before payment. */
ordersRouter.post(
  '/preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        productId: z.string().min(3),
        recipient: z.string().min(8).max(20),
        quantity: z.number().int().min(1).max(100).default(1),
      }),
      req.body,
    );
    const product = getProduct(body.productId);
    if (!product) throw ApiError.notFound('Product not found');

    const { bulkDiscountRate } = await import('../lib/payments.js');
    const discount = bulkDiscountRate(body.quantity);
    const amountCents = Math.round(product.price_cents * body.quantity * (1 - discount));
    const risk = assessRisk({
      userId: req.user!.id,
      product,
      recipient: body.recipient,
      quantity: body.quantity,
      amountCents,
    });

    res.json({
      product: serializeProduct(product),
      amountCents,
      discountRate: discount,
      deliveryFeeCents: 0,
      risk: {
        score: risk.score,
        band: risk.band,
        decision: risk.decision,
        explanationEn: risk.explanationEn,
        explanationKm: risk.explanationKm,
        features: risk.features,
      },
    });
  }),
);
