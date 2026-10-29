import { q } from '../db/index.js';
import type { Product } from '../types.js';
import { expandQuery, cosine, tokenize, termFrequency, type Vector } from './text.js';

/**
 * Hybrid recommender: content similarity + behavioural signals + popularity
 * prior, blended with per-customer learned provider/price preferences. This is
 * the "cold-start-safe" design used when there is no collaborative matrix yet.
 */
export interface Recommendation {
  product: Product;
  score: number;
  reasonsEn: string[];
  reasonsKm: string[];
}

interface PreferenceProfile {
  providers: Map<string, number>;
  categories: Map<string, number>;
  averageSpendCents: number;
  purchaseCount: number;
  recentSearches: string[];
}

export function buildProfile(userId: string): PreferenceProfile {
  const orders = q.all<{ provider: string; category: string; amount_cents: number; created_at: string }>(
    `SELECT p.provider, p.category, o.amount_cents, o.created_at
     FROM orders o JOIN products p ON p.id = o.product_id
     WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 60`,
    userId,
  );

  const providers = new Map<string, number>();
  const categories = new Map<string, number>();
  let total = 0;

  orders.forEach((order, index) => {
    const recency = Math.pow(0.93, index); // exponential recency decay
    providers.set(order.provider, (providers.get(order.provider) ?? 0) + recency);
    categories.set(order.category, (categories.get(order.category) ?? 0) + recency);
    total += order.amount_cents;
  });

  return {
    providers,
    categories,
    averageSpendCents: orders.length ? total / orders.length : 0,
    purchaseCount: orders.length,
    recentSearches: [],
  };
}

const toVector = (text: string): Vector => {
  const tf = termFrequency(tokenize(text));
  const max = Math.max(...tf.values(), 1);
  const vector: Vector = new Map();
  for (const [token, count] of tf) vector.set(token, count / max);
  return vector;
};

const productText = (product: Product) =>
  [
    product.name_en,
    product.name_km,
    product.category,
    product.provider,
    product.description_en,
    product.tags,
    product.badge ?? '',
  ].join(' ');

function norm(values: Map<string, number>): Map<string, number> {
  const max = Math.max(...values.values(), 1);
  return new Map([...values].map(([key, value]) => [key, value / max]));
}

export function recommendForUser(
  userId: string,
  options: { limit?: number; query?: string; category?: string } = {},
): Recommendation[] {
  const { limit = 6, query, category } = options;
  const profile = buildProfile(userId);
  const providerWeights = norm(profile.providers);
  const categoryWeights = norm(profile.categories);
  const queryVector = query ? toVector(expandQuery(query)) : null;

  const products = q.all<Product>('SELECT * FROM products WHERE active = 1');
  const scored = products.map((product) => {
    const reasonsEn: string[] = [];
    const reasonsKm: string[] = [];

    const content = queryVector ? cosine(queryVector, toVector(productText(product))) : 0;
    if (content > 0.18) {
      reasonsEn.push('Matches what you asked for');
      reasonsKm.push('ត្រូវនឹងអ្វីដែលអ្នកស្វែងរក');
    }

    const affinity = providerWeights.get(product.provider) ?? 0;
    if (affinity > 0.25) {
      reasonsEn.push(`You often use ${product.provider}`);
      reasonsKm.push(`អ្នកប្រើ ${product.provider} ញឹកញាប់`);
    }

    const categoryAffinity = categoryWeights.get(product.category) ?? 0;
    if (categoryAffinity > 0.3 && reasonsEn.length < 2) {
      reasonsEn.push('Popular in a category you use');
      reasonsKm.push('ពេញនិយមក្នុងប្រភេទដែលអ្នកប្រើ');
    }

    // Price-fit: reward products close to (but not far below) usual spend.
    let priceFit = 0;
    if (profile.averageSpendCents > 0) {
      const ratio = product.price_cents / profile.averageSpendCents;
      priceFit = Math.max(0, 1 - Math.abs(Math.log(ratio || 1)));
      if (priceFit > 0.75) {
        reasonsEn.push('Fits your usual budget');
        reasonsKm.push('សមនឹងថវិកាធម្មតារបស់អ្នក');
      }
    }

    const valueScore = Math.max(
      0,
      Math.min(1, (product.face_value_cents - product.price_cents) / Math.max(product.face_value_cents, 1)),
    );
    const categoryBoost = category && product.category === category ? 0.35 : 0;

    const score =
      content * 0.34 +
      affinity * 0.22 +
      categoryAffinity * 0.12 +
      priceFit * 0.1 +
      product.popularity * 0.14 +
      valueScore * 0.08 +
      categoryBoost;

    if (!reasonsEn.length) {
      reasonsEn.push('Top pick for customers like you');
      reasonsKm.push('ជម្រើសកំពូលសម្រាប់អ្នកប្រើដូចអ្នក');
    }

    return { product, score: Number(score.toFixed(4)), reasonsEn: reasonsEn.slice(0, 2), reasonsKm: reasonsKm.slice(0, 2) };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** "Customers also bought" — co-purchase lift from real order data. */
export function alsoBought(productId: string, limit = 4): Product[] {
  const pairs = q.all<{ product_id: string; lift: number }>(
    `SELECT other.product_id AS product_id, COUNT(*) AS lift
     FROM orders mine
     JOIN orders other ON other.user_id = mine.user_id AND other.product_id != mine.product_id
     WHERE mine.product_id = ?
     GROUP BY other.product_id
     ORDER BY lift DESC
     LIMIT ?`,
    productId,
    limit,
  );
  if (!pairs.length) {
    return q.all<Product>('SELECT * FROM products WHERE active = 1 AND id != ? ORDER BY popularity DESC LIMIT ?', productId, limit);
  }
  return pairs
    .map((pair) => q.get<Product>('SELECT * FROM products WHERE id = ? AND active = 1', pair.product_id))
    .filter((product): product is Product => Boolean(product));
}
