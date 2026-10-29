import { q } from '../db/index.js';
import { ApiError } from '../lib/http.js';
import { uuid, nowIso, deliveryCode, reference } from '../lib/ids.js';
import { getProduct } from '../ai/catalog.js';
import { assessRisk } from '../ai/risk.js';
import type { OrderRow, UserRow, WalletRow } from '../types.js';

export const POINTS_PER_DOLLAR = 40; // 1 point per 100 riel (~4,100 KHR/USD)
const BULK_THRESHOLD = 10;

export function bulkDiscountRate(quantity: number): number {
  if (quantity >= 50) return 0.06;
  if (quantity >= 25) return 0.045;
  if (quantity >= BULK_THRESHOLD) return 0.03;
  return 0;
}

export function getWallet(userId: string): WalletRow {
  const wallet = q.get<WalletRow>('SELECT * FROM wallets WHERE user_id = ?', userId);
  if (wallet) return wallet;
  const created: WalletRow = {
    user_id: userId,
    balance_cents: 0,
    currency: 'USD',
    points: 0,
    updated_at: nowIso(),
  };
  q.run(
    'INSERT INTO wallets (user_id, balance_cents, currency, points, updated_at) VALUES (?, ?, ?, ?, ?)',
    created.user_id,
    created.balance_cents,
    created.currency,
    created.points,
    created.updated_at,
  );
  return created;
}

/** Atomic wallet ledger write. Positive = credit, negative = debit. */
export function postLedger(
  userId: string,
  type: string,
  amountCents: number,
  description: string,
  ref: string | null = null,
): WalletRow {
  return q.transaction(() => {
    const wallet = getWallet(userId);
    const nextBalance = wallet.balance_cents + amountCents;
    if (nextBalance < 0) throw ApiError.badRequest('Insufficient wallet balance');
    q.run(
      'UPDATE wallets SET balance_cents = ?, updated_at = ? WHERE user_id = ?',
      nextBalance,
      nowIso(),
      userId,
    );
    q.run(
      `INSERT INTO transactions (id, user_id, type, amount_cents, balance_after_cents, reference, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      uuid(),
      userId,
      type,
      amountCents,
      nextBalance,
      ref,
      description,
      nowIso(),
    );
    return { ...wallet, balance_cents: nextBalance };
  });
}

export interface PurchaseInput {
  user: Pick<UserRow, 'id'>;
  productId: string;
  recipient: string;
  quantity?: number;
  channel?: string;
  idempotencyKey?: string | null;
}

export interface PurchaseResult {
  order: OrderRow;
  wallet: WalletRow;
  risk: ReturnType<typeof assessRisk>;
  productName: { en: string; km: string };
}

export function purchase(input: PurchaseInput): PurchaseResult {
  const quantity = input.quantity ?? 1;
  if (quantity < 1 || quantity > 100) throw ApiError.badRequest('Quantity must be between 1 and 100');

  const product = getProduct(input.productId);
  if (!product || !product.active) throw ApiError.notFound('That product is no longer available');

  const digits = input.recipient.replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 8) {
    throw ApiError.badRequest('Enter a valid recipient number (at least 8 digits)');
  }

  const discount = bulkDiscountRate(quantity);
  const amountCents = Math.round(product.price_cents * quantity * (1 - discount));

  const risk = assessRisk({
    userId: input.user.id,
    product,
    recipient: digits,
    quantity,
    amountCents,
  });
  if (risk.decision === 'block') {
    throw new ApiError(422, 'risk_blocked', 'This order was blocked by our fraud protection', {
      risk,
    });
  }

  const wallet = getWallet(input.user.id);
  if (wallet.balance_cents < amountCents) {
    throw new ApiError(402, 'insufficient_funds', 'Not enough wallet balance for this order', {
      requiredCents: amountCents,
      balanceCents: wallet.balance_cents,
    });
  }

  const orderId = uuid();
  const ref = reference();
  const status = risk.decision === 'review' ? 'review' : 'paid';
  const pointsEarned = Math.round((amountCents / 100) * POINTS_PER_DOLLAR);

  const result = q.transaction(() => {
    const updated = postLedger(
      input.user.id,
      'purchase',
      -amountCents,
      `${product.name_en} x${quantity} → ${digits}`,
      ref,
    );

    q.run(
      `INSERT INTO orders (id, reference, user_id, product_id, recipient, quantity, amount_cents,
        points_earned, status, delivery_code, risk_score, risk_flags, channel, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      orderId,
      ref,
      input.user.id,
      product.id,
      digits,
      quantity,
      amountCents,
      pointsEarned,
      status,
      risk.decision === 'review' ? null : deliveryCode(product.category),
      risk.score,
      JSON.stringify(risk.flags),
      input.channel ?? 'web',
      input.idempotencyKey ?? null,
      nowIso(),
    );

    if (risk.decision === 'allow') {
      q.run('UPDATE wallets SET points = points + ? WHERE user_id = ?', pointsEarned, input.user.id);
    }

    q.run(
      'INSERT INTO events (id, user_id, name, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      uuid(),
      input.user.id,
      'order_created',
      JSON.stringify({ productId: product.id, amountCents, risk: risk.score, status }),
      nowIso(),
    );

    return updated;
  });

  const order = q.get<OrderRow>('SELECT * FROM orders WHERE id = ?', orderId)!;
  return {
    order,
    wallet: { ...result, points: result.points + (risk.decision === 'allow' ? pointsEarned : 0) },
    risk,
    productName: { en: product.name_en, km: product.name_km },
  };
}

export function serializeOrder(order: Record<string, unknown>) {
  return {
    id: order.id,
    reference: order.reference,
    productId: order.product_id,
    productNameEn: (order.product_name_en as string) ?? undefined,
    productNameKm: (order.product_name_km as string) ?? undefined,
    recipient: order.recipient,
    quantity: order.quantity,
    amountCents: order.amount_cents,
    pointsEarned: order.points_earned,
    status: order.status,
    deliveryCode: order.delivery_code,
    riskScore: order.risk_score,
    riskFlags: JSON.parse((order.risk_flags as string) || '[]') as string[],
    channel: order.channel,
    createdAt: order.created_at,
  };
}
