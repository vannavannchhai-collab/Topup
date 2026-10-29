import { q } from '../db/index.js';
import type { Product } from '../types.js';
import { TfidfIndex, expandQuery } from './text.js';

let index: TfidfIndex | null = null;
let cached: Product[] = [];

export function activeProducts(): Product[] {
  return q.all<Product>('SELECT * FROM products WHERE active = 1');
}

/** (Re)build the in-memory retrieval index over everything sellable. */
export function refreshCatalogIndex(): TfidfIndex {
  cached = activeProducts();
  const built = new TfidfIndex();
  for (const product of cached) {
    const doc = [
      product.name_en,
      product.name_km,
      product.category,
      product.provider,
      product.description_en,
      product.description_km,
      product.tags,
      product.badge ?? '',
      product.data_gb ? `${product.data_gb} GB data` : '',
      product.validity_days ? `${product.validity_days} days` : '',
      product.price_cents ? `price ${(product.price_cents / 100).toFixed(2)} USD` : '',
    ].join(' ');
    built.add(product.id, doc, [product.provider, product.category]);
  }
  index = built.build();
  return index;
}

function ensureIndex(): TfidfIndex {
  return index ?? refreshCatalogIndex();
}

export interface ScoredProduct {
  product: Product;
  score: number;
}

export function semanticSearch(query: string, limit = 8): ScoredProduct[] {
  const searchIndex = ensureIndex();
  const byId = new Map(cached.map((product) => [product.id, product]));
  const expanded = expandQuery(query);
  const lexical = searchIndex.search(expanded, limit * 3);

  return lexical
    .map((hit) => {
      const product = byId.get(hit.id);
      if (!product) return null;
      // Popularity is a mild prior so ties break toward proven inventory.
      const score = hit.score * 0.85 + product.popularity * 0.15;
      return { product, score };
    })
    .filter((entry): entry is ScoredProduct => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getProduct(id: string): Product | undefined {
  return q.get<Product>('SELECT * FROM products WHERE id = ?', id);
}

export function productsByCategory(category: string): Product[] {
  return q.all<Product>('SELECT * FROM products WHERE category = ? AND active = 1 ORDER BY popularity DESC', category);
}

export function categorySummary(): { category: string; count: number }[] {
  return q.all<{ category: string; count: number }>(
    'SELECT category, COUNT(*) as count FROM products WHERE active = 1 GROUP BY category ORDER BY count DESC',
  );
}

export function serializeProduct(product: Product) {
  return {
    id: product.id,
    sku: product.sku,
    nameEn: product.name_en,
    nameKm: product.name_km,
    category: product.category,
    provider: product.provider,
    faceValueCents: product.face_value_cents,
    priceCents: product.price_cents,
    dataGb: product.data_gb,
    minutes: product.minutes,
    validityDays: product.validity_days,
    descriptionEn: product.description_en,
    descriptionKm: product.description_km,
    tags: product.tags ? product.tags.split(',').filter(Boolean) : [],
    badge: product.badge,
    popularity: product.popularity,
  };
}
