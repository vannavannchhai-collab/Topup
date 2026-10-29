import { Router } from 'express';
import { q } from '../db/index.js';
import { asyncHandler } from '../lib/http.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { buildForecast, densifyDaily } from '../ai/forecast.js';
import { serializeOrder } from '../lib/payments.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  '/metrics',
  asyncHandler(async (_req, res) => {
    const revenue = q.get<{ total: number; orders: number; avg: number }>(
      `SELECT COALESCE(SUM(amount_cents),0) AS total, COUNT(*) AS orders, COALESCE(AVG(amount_cents),0) AS avg
       FROM orders WHERE status != 'refunded'`,
    );
    const users = q.get<{ total: number; new7: number }>(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN created_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS new7
       FROM users`,
    );
    const reviewQueue = q.get<{ total: number }>(`SELECT COUNT(*) AS total FROM orders WHERE status = 'review'`);
    const gmvToday = q.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_cents),0) AS total FROM orders WHERE substr(created_at,1,10) = date('now')`,
    );
    const gmvYesterday = q.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_cents),0) AS total FROM orders WHERE substr(created_at,1,10) = date('now','-1 day')`,
    );
    const daily = q.all<{ date: string; orders: number; revenue: number }>(
      `SELECT substr(created_at,1,10) AS date, COUNT(*) AS orders, COALESCE(SUM(amount_cents),0) AS revenue
       FROM orders WHERE created_at >= datetime('now','-45 days')
       GROUP BY date ORDER BY date`,
    );

    const growth = gmvYesterday?.total
      ? ((gmvToday?.total ?? 0) - gmvYesterday.total) / gmvYesterday.total
      : 0;

    res.json({
      revenueCents: revenue?.total ?? 0,
      orderCount: revenue?.orders ?? 0,
      averageOrderCents: Math.round(revenue?.avg ?? 0),
      users: users?.total ?? 0,
      newUsers7d: users?.new7 ?? 0,
      reviewQueue: reviewQueue?.total ?? 0,
      gmvTodayCents: gmvToday?.total ?? 0,
      gmvGrowth: Number((growth * 100).toFixed(1)),
      daily,
    });
  }),
);

adminRouter.get(
  '/forecast',
  asyncHandler(async (req, res) => {
    const horizon = Math.min(30, Number(req.query.horizon ?? 7));
    const rows = q.all<{ date: string; value: number }>(
      `SELECT substr(created_at,1,10) AS date, COALESCE(SUM(amount_cents),0) AS value
       FROM orders WHERE created_at >= datetime('now','-45 days')
       GROUP BY date ORDER BY date`,
    );
    const revenueSeries = densifyDaily(rows, 45);
    const orderRows = q.all<{ date: string; value: number }>(
      `SELECT substr(created_at,1,10) AS date, COUNT(*) AS value
       FROM orders WHERE created_at >= datetime('now','-45 days')
       GROUP BY date ORDER BY date`,
    );
    const orderSeries = densifyDaily(orderRows, 45);

    res.json({
      revenue: buildForecast(revenueSeries.map((p) => ({ date: p.date, value: Math.round(p.value / 100) })), horizon),
      orders: buildForecast(orderSeries, horizon),
    });
  }),
);

adminRouter.get(
  '/top-products',
  asyncHandler(async (_req, res) => {
    const rows = q.all<{
      id: string;
      name_en: string;
      name_km: string;
      category: string;
      provider: string;
      units: number;
      revenue: number;
    }>(
      `SELECT p.id, p.name_en, p.name_km, p.category, p.provider,
              COALESCE(SUM(o.quantity),0) AS units, COALESCE(SUM(o.amount_cents),0) AS revenue
       FROM products p LEFT JOIN orders o ON o.product_id = p.id AND o.status != 'refunded'
       GROUP BY p.id ORDER BY revenue DESC LIMIT 12`,
    );
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        nameEn: row.name_en,
        nameKm: row.name_km,
        category: row.category,
        provider: row.provider,
        units: row.units,
        revenueCents: row.revenue,
      })),
    });
  }),
);

adminRouter.get(
  '/risk-queue',
  asyncHandler(async (_req, res) => {
    const rows = q.all<Record<string, unknown>>(
      `SELECT o.*, p.name_en AS product_name_en, p.name_km AS product_name_km, u.email, u.name
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN users u ON u.id = o.user_id
       WHERE o.status = 'review' OR o.risk_score >= 0.42
       ORDER BY o.risk_score DESC, o.created_at DESC LIMIT 30`,
    );
    res.json({
      items: rows.map((row) => ({
        ...serializeOrder(row),
        customer: { email: row.email, name: row.name },
      })),
    });
  }),
);

adminRouter.post(
  '/risk-queue/:id/decision',
  asyncHandler(async (req, res) => {
    const action = String((req.body as { action?: string }).action ?? '');
    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: { code: 'bad_request', message: 'action must be approve or reject' } });
      return;
    }
    const order = q.get<{ id: string; status: string; amount_cents: number; user_id: string; delivery_code: string | null }>(
      'SELECT id, status, amount_cents, user_id, delivery_code FROM orders WHERE id = ?',
      String(req.params.id),
    );
    if (!order) {
      res.status(404).json({ error: { code: 'not_found', message: 'Order not found' } });
      return;
    }

    if (action === 'approve') {
      q.run(
        "UPDATE orders SET status = 'paid', delivery_code = COALESCE(delivery_code, ?) WHERE id = ?",
        `APR-${order.id.slice(0, 8).toUpperCase()}`,
        order.id,
      );
      q.run('UPDATE wallets SET points = points + ? WHERE user_id = ?', Math.round(order.amount_cents / 100 * 40), order.user_id);
    } else {
      q.run("UPDATE orders SET status = 'refunded' WHERE id = ?", order.id);
      const wallet = q.get<{ balance_cents: number }>('SELECT balance_cents FROM wallets WHERE user_id = ?', order.user_id);
      if (wallet) {
        const next = wallet.balance_cents + order.amount_cents;
        q.transaction(() => {
          q.run('UPDATE wallets SET balance_cents = ?, updated_at = datetime(\'now\') WHERE user_id = ?', next, order.user_id);
          q.run(
            `INSERT INTO transactions (id, user_id, type, amount_cents, balance_after_cents, reference, description, created_at)
             VALUES (?, ?, 'refund', ?, ?, ?, 'Risk review refund', datetime('now'))`,
            `txn_${Date.now()}_${order.id.slice(0, 6)}`,
            order.user_id,
            order.amount_cents,
            next,
            order.id,
          );
        });
      }
    }
    res.json({ ok: true, action });
  }),
);

adminRouter.get(
  '/customers',
  asyncHandler(async (_req, res) => {
    const rows = q.all<{
      id: string;
      name: string;
      email: string;
      created_at: string;
      orders: number;
      spend: number;
      balance: number;
      points: number;
    }>(
      `SELECT u.id, u.name, u.email, u.created_at,
              COUNT(o.id) AS orders,
              COALESCE(SUM(o.amount_cents),0) AS spend,
              COALESCE(w.balance_cents,0) AS balance,
              COALESCE(w.points,0) AS points
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.role != 'admin'
       GROUP BY u.id ORDER BY spend DESC LIMIT 50`,
    );
    res.json({
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        createdAt: row.created_at,
        orders: row.orders,
        spendCents: row.spend,
        balanceCents: row.balance,
        points: row.points,
      })),
    });
  }),
);

adminRouter.get(
  '/assistant-stats',
  asyncHandler(async (_req, res) => {
    const total = q.get<{ count: number }>(`SELECT COUNT(*) AS count FROM messages WHERE role = 'user'`);
    const intents = q.all<{ intent: string; count: number }>(
      `SELECT json_extract(meta,'$.intent') AS intent, COUNT(*) AS count
       FROM messages WHERE role = 'assistant' AND json_extract(meta,'$.intent') IS NOT NULL
       GROUP BY intent ORDER BY count DESC`,
    );
    const latency = q.get<{ avg: number }>(
      `SELECT COALESCE(AVG(json_extract(payload,'$.latencyMs')),0) AS avg
       FROM events WHERE name = 'assistant_answer'`,
    );
    res.json({
      questions: total?.count ?? 0,
      intents: intents.map((row) => ({ intent: row.intent, count: row.count })),
      averageLatencyMs: Math.round(latency?.avg ?? 0),
    });
  }),
);
