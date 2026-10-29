import { Router } from 'express';
import { q } from '../db/index.js';
import { ApiError, asyncHandler } from '../lib/http.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  activeProducts,
  categorySummary,
  getProduct,
  semanticSearch,
  serializeProduct,
} from '../ai/catalog.js';
import { alsoBought, recommendForUser } from '../ai/recommend.js';
import type { Product } from '../types.js';

export const productsRouter = Router();

const PROVIDER_LABELS: Record<string, { en: string; km: string }> = {
  cellcard: { en: 'Cellcard', km: 'សែលកាត' },
  smart: { en: 'Smart Axiata', km: 'ស្មាត' },
  metfone: { en: 'Metfone', km: 'មេតហ្វូន' },
  seatel: { en: 'Seatel', km: 'ស៊ីតេល' },
  edc: { en: 'EDC', km: 'អគ្គិសនីកម្ពុជា' },
  ppwsa: { en: 'Phnom Penh Water', km: 'ទឹកស្អាតភ្នំពេញ' },
  isp: { en: 'Home Internet', km: 'អ៊ីនធឺណិតផ្ទះ' },
  garena: { en: 'Garena', km: 'ហ្គារេណា' },
  moonton: { en: 'Moonton', km: 'មូនតុន' },
  netflix: { en: 'Netflix', km: 'ណេតហ្វ្លិច' },
  spotify: { en: 'Spotify', km: 'ស្ពតីហ្វាយ' },
  google: { en: 'Google Play', km: 'ហ្គូហ្គោលផ្លេ' },
  nova: { en: 'NOVA eSIM', km: 'NOVA eSIM' },
};

const CATEGORY_LABELS: Record<string, { en: string; km: string }> = {
  mobile: { en: 'Mobile top-up', km: 'បញ្ចូលលុយទូរស័ព្ទ' },
  data: { en: 'Data bundles', km: 'កញ្ចប់អ៊ីនធឺណិត' },
  gaming: { en: 'Game credits', km: 'ហ្គេម' },
  bills: { en: 'Bill payments', km: 'បង់វិក្កយបត្រ' },
  entertainment: { en: 'Entertainment', km: 'កម្សាន្ត' },
  esim: { en: 'Travel eSIM', km: 'eSIM ធ្វើដំណើរ' },
};

productsRouter.get('/', (req, res) => {
  const { category, provider, q: search, sort = 'popularity', max, min } = req.query as Record<string, string | undefined>;
  let items = activeProducts();

  if (category) items = items.filter((product) => product.category === category);
  if (provider) items = items.filter((product) => product.provider === provider);
  if (min) items = items.filter((product) => product.price_cents >= Number(min) * 100);
  if (max) items = items.filter((product) => product.price_cents <= Number(max) * 100);
  if (search) {
    const ids = new Set(semanticSearch(search, 50).map((hit) => hit.product.id));
    items = items.filter((product) => ids.has(product.id));
  }

  const sorters: Record<string, (a: Product, b: Product) => number> = {
    popularity: (a, b) => b.popularity - a.popularity,
    price_asc: (a, b) => a.price_cents - b.price_cents,
    price_desc: (a, b) => b.price_cents - a.price_cents,
    value: (a, b) =>
      (b.face_value_cents - b.price_cents) / b.face_value_cents -
      (a.face_value_cents - a.price_cents) / a.face_value_cents,
  };
  items = [...items].sort(sorters[sort] ?? sorters.popularity);

  res.json({
    items: items.map(serializeProduct),
    total: items.length,
    categories: categorySummary().map((entry) => ({
      ...entry,
      labelEn: CATEGORY_LABELS[entry.category]?.en ?? entry.category,
      labelKm: CATEGORY_LABELS[entry.category]?.km ?? entry.category,
    })),
    providers: Object.entries(PROVIDER_LABELS).map(([id, label]) => ({ id, ...label })),
  });
});

productsRouter.get(
  '/recommendations',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(12, Number(req.query.limit ?? 6));
    if (req.user) {
      const recs = recommendForUser(req.user.id, { limit });
      res.json({
        personalized: true,
        items: recs.map((rec) => ({
          ...serializeProduct(rec.product),
          score: rec.score,
          reasonsEn: rec.reasonsEn,
          reasonsKm: rec.reasonsKm,
        })),
      });
      return;
    }
    const trending = activeProducts()
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit)
      .map(serializeProduct);
    res.json({ personalized: false, items: trending });
  }),
);

productsRouter.get('/categories', (_req, res) => {
  res.json({
    categories: categorySummary().map((entry) => ({
      ...entry,
      labelEn: CATEGORY_LABELS[entry.category]?.en ?? entry.category,
      labelKm: CATEGORY_LABELS[entry.category]?.km ?? entry.category,
    })),
  });
});

productsRouter.get('/:id', (req, res) => {
  const product = getProduct(String(req.params.id));
  if (!product) throw ApiError.notFound('Product not found');
  const related = alsoBought(product.id, 4);
  res.json({
    product: serializeProduct(product),
    related: related.map(serializeProduct),
    providerLabel: PROVIDER_LABELS[product.provider] ?? { en: product.provider, km: product.provider },
  });
});

productsRouter.get('/:id/orders', (req, res) => {
  const count = q.get<{ count: number }>('SELECT COUNT(*) as count FROM orders WHERE product_id = ?', String(req.params.id));
  res.json({ purchases: count?.count ?? 0 });
});
