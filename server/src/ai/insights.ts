import { q } from '../db/index.js';
import type { Product } from '../types.js';
import { recommendForUser } from './recommend.js';
import { money } from './util.js';

/**
 * Proactive, generative customer insights.
 *
 * Each insight is derived from real account data with deterministic rules +
 * the recommender, so the numbers always reconcile with the wallet ledger.
 */
export interface Insight {
  id: string;
  tone: 'info' | 'win' | 'warning' | 'tip';
  titleEn: string;
  titleKm: string;
  bodyEn: string;
  bodyKm: string;
  metric?: string;
  actionRoute?: string;
}

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export function buildInsights(userId: string): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const orders = q.all<{
    id: string;
    created_at: string;
    amount_cents: number;
    quantity: number;
    product_id: string;
    provider: string;
    category: string;
    name_en: string;
    name_km: string;
    data_gb: number | null;
    validity_days: number | null;
    price_cents: number;
  }>(
    `SELECT o.id, o.created_at, o.amount_cents, o.quantity, o.product_id,
            p.provider, p.category, p.name_en, p.name_km, p.data_gb, p.validity_days, p.price_cents
     FROM orders o JOIN products p ON p.id = o.product_id
     WHERE o.user_id = ? AND o.status != 'refunded'
     ORDER BY o.created_at DESC`,
    userId,
  );

  const wallet = q.get<{ balance_cents: number; points: number }>(
    'SELECT balance_cents, points FROM wallets WHERE user_id = ?',
    userId,
  );

  if (!orders.length) {
    const first = recommendForUser(userId, { limit: 1 })[0];
    insights.push({
      id: 'first-pick',
      tone: 'tip',
      titleEn: 'Your first AI-matched bundle',
      titleKm: 'កញ្ចប់ដំបូងដែល AI ជ្រើសសម្រាប់អ្នក',
      bodyEn: first
        ? `${first.product.name_en} at ${money(first.product.price_cents)} is the best entry point for customers like you.`
        : 'Browse the catalog to unlock personalised picks.',
      bodyKm: first
        ? `${first.product.name_km} តម្លៃ ${money(first.product.price_cents)} ជាចំណុចចាប់ផ្តើមល្អបំផុតសម្រាប់អ្នក។`
        : 'រកមើលហាង ដើម្បីទទួលបានជម្រើសផ្ទាល់ខ្លួន។',
      actionRoute: '/shop',
    });
    return insights;
  }

  // 1. Month-over-month spend trend.
  const thisMonth = orders
    .filter((order) => new Date(order.created_at) >= monthStart)
    .reduce((sum, order) => sum + order.amount_cents, 0);
  const lastMonth = orders
    .filter((order) => {
      const date = new Date(order.created_at);
      return date >= prevStart && date < monthStart;
    })
    .reduce((sum, order) => sum + order.amount_cents, 0);

  if (lastMonth > 0) {
    const delta = ((thisMonth - lastMonth) / lastMonth) * 100;
    const up = delta >= 0;
    insights.push({
      id: 'spend-trend',
      tone: up ? 'info' : 'win',
      titleEn: `Spending is ${up ? 'up' : 'down'} ${Math.abs(delta).toFixed(0)}% this month`,
      titleKm: `ការចំណាយ${up ? 'កើនឡើង' : 'ថយចុះ'} ${Math.abs(delta).toFixed(0)}% ខែនេះ`,
      bodyEn: `${money(thisMonth)} so far vs ${money(lastMonth)} last month. ${
        up
          ? 'A 7-day bundle would cut about 12% off your running rate.'
          : 'Nice — your AI-guided picks are saving you money.'
      }`,
      bodyKm: `${money(thisMonth)} ខែនេះ ធៀបនឹង ${money(lastMonth)} ខែមុន។ ${
        up ? 'កញ្ចប់ 7 ថ្ងៃអាចសន្សំបានប្រហែល 12%។' : 'ល្អណាស់ — ជម្រើសដែល AI ណែនាំកំពុងជួយសន្សំប្រាក់។'
      }`,
      metric: money(thisMonth),
      actionRoute: '/shop?category=data',
    });
  }

  // 2. Repeat-buy pattern → predict the next top-up date.
  const intervals: number[] = [];
  for (let index = 1; index < Math.min(orders.length, 12); index += 1) {
    const diff =
      (new Date(orders[index - 1].created_at).getTime() - new Date(orders[index].created_at).getTime()) /
      86_400_000;
    if (diff > 0.2 && diff < 45) intervals.push(diff);
  }
  const cadenceDays = median(intervals);
  if (cadenceDays > 0) {
    const last = new Date(orders[0].created_at);
    const next = new Date(last.getTime() + cadenceDays * 86_400_000);
    const inDays = Math.max(0, Math.round((next.getTime() - now.getTime()) / 86_400_000));
    const frequent = orders[0];
    insights.push({
      id: 'next-topup',
      tone: 'tip',
      titleEn: inDays > 0 ? `Next top-up predicted in ${inDays} day${inDays === 1 ? '' : 's'}` : 'You are due for a top-up',
      titleKm: inDays > 0 ? `ការបញ្ចូលលុយបន្ទាប់ រំពឹងក្នុង ${inDays} ថ្ងៃ` : 'ដល់ពេលបញ្ចូលលុយហើយ',
      bodyEn: `${
        cadenceDays <= 1.5 ? 'You usually top up daily.' : `You usually renew every ${cadenceDays.toFixed(0)} days.`
      } Last pick: ${frequent.name_en} (${money(frequent.price_cents)}).`,
      bodyKm: `${
        cadenceDays <= 1.5 ? 'អ្នកបញ្ចូលលុយរាល់ថ្ងៃ។' : `អ្នកបញ្ចូលលុយរាល់ ${cadenceDays.toFixed(0)} ថ្ងៃ។`
      } ជម្រើសចុងក្រោយ៖ ${frequent.name_km} (${money(frequent.price_cents)})។`,
      metric: `${cadenceDays.toFixed(0)}d`,
      actionRoute: `/shop?product=${frequent.product_id}`,
    });
  }

  // 3. Better-value alternative for the most frequent data purchase.
  const dataOrders = orders.filter((order) => order.category === 'data');
  if (dataOrders.length) {
    const favourite = dataOrders[0];
    const alternatives = q.all<Product>(
      `SELECT * FROM products
       WHERE active = 1 AND category = 'data' AND provider = ? AND id != ?
         AND price_cents <= ? AND COALESCE(data_gb,0) >= ?
       ORDER BY data_gb DESC, price_cents ASC LIMIT 1`,
      favourite.provider,
      favourite.product_id,
      Math.round(favourite.price_cents * 1.15),
      favourite.data_gb ?? 0,
    );
    const better = alternatives[0];
    if (better) {
      insights.push({
        id: 'value-swap',
        tone: 'win',
        titleEn: 'A better value bundle exists',
        titleKm: 'មានកញ្ចប់តម្លៃល្អជាង',
        bodyEn: `${better.name_en} gives ${better.data_gb}GB for ${money(better.price_cents)} — more data for about the same price as ${favourite.name_en}.`,
        bodyKm: `${better.name_km} ផ្តល់ ${better.data_gb}GB ក្នុងតម្លៃ ${money(better.price_cents)} — ទិន្នន័យច្រើនជាង តម្លៃប្រហាក់ប្រហែល ${favourite.name_km}។`,
        metric: `+${((better.data_gb ?? 0) - (favourite.data_gb ?? 0)).toFixed(0)}GB`,
        actionRoute: `/shop?product=${better.id}`,
      });
    }
  }

  // 4. Wallet runway + points reminder.
  if (wallet) {
    const avgOrder = Math.round(orders.reduce((sum, order) => sum + order.amount_cents, 0) / orders.length);
    const runway = avgOrder > 0 ? Math.floor(wallet.balance_cents / avgOrder) : 0;
    if (wallet.points >= 100) {
      insights.push({
        id: 'points',
        tone: 'win',
        titleEn: `${wallet.points} points ready to redeem`,
        titleKm: `មាន ${wallet.points} ពិន្ទុ អាចប្តូរបាន`,
        bodyEn: `That converts to ${money(wallet.points)} of wallet credit — instant, no minimum order.`,
        bodyKm: `អាចប្តូរបាន ${money(wallet.points)} ជាឥណទានកាបូប — ភ្លាមៗ គ្មានការបញ្ជាទិញអប្បបរមា។`,
        metric: `${wallet.points} pts`,
        actionRoute: '/wallet',
      });
    } else if (runway <= 1) {
      insights.push({
        id: 'runway',
        tone: runway === 0 ? 'warning' : 'info',
        titleEn: 'Wallet runway is short',
        titleKm: 'សមតុល្យកាបូបជិតអស់',
        bodyEn: `Your balance covers about ${runway} more order${runway === 1 ? '' : 's'} at your average spend of ${money(
          avgOrder,
        )}. Add funds to avoid interruption.`,
        bodyKm: `សមតុល្យរបស់អ្នកគ្រប់គ្រាន់សម្រាប់ការបញ្ជាទិញប្រហែល ${runway} បន្ថែម តាមការចំណាយមធ្យម ${money(avgOrder)}។`,
        actionRoute: '/wallet',
      });
    }
  }

  // 5. Provider loyalty note (explains personalisation).
  const providerCounts = new Map<string, number>();
  for (const order of orders) providerCounts.set(order.provider, (providerCounts.get(order.provider) ?? 0) + 1);
  const [topProvider, topCount] = [...providerCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  if (topProvider && topCount >= 2) {
    insights.push({
      id: 'loyalty',
      tone: 'info',
      titleEn: `NOVA is tuned to ${topProvider}`,
      titleKm: `NOVA ត្រូវបានកំណត់សម្រាប់ ${topProvider}`,
      bodyEn: `${topCount} of your ${orders.length} orders were on ${topProvider}, so recommendations prioritise that network first.`,
      bodyKm: `${topCount} ក្នុងចំណោម ${orders.length} ការបញ្ជាទិញរបស់អ្នក គឺលើ ${topProvider} ដូច្នេះការណែនាំផ្តល់អាទិភាពបណ្តាញនេះ។`,
      metric: `${topCount}x`,
      actionRoute: `/shop?provider=${topProvider}`,
    });
  }

  return insights.slice(0, 4);
}
