import { clsx } from 'clsx';
import { PackageSearch, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useAsync, useDebounced } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import type { CategorySummary, Product, ProviderSummary } from '../lib/types';
import { CheckoutModal } from '../components/Checkout';
import { ProductCard } from '../components/ProductCard';
import { Badge, EmptyState, Skeleton } from '../components/ui';

const SORTS = [
  { id: 'popularity', key: 'shop.sortPopular' },
  { id: 'price_asc', key: 'shop.sortPriceAsc' },
  { id: 'price_desc', key: 'shop.sortPriceDesc' },
  { id: 'value', key: 'shop.sortValue' },
];

export function ShopPage() {
  const { t, pickText } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebounced(search, 320);
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [provider, setProvider] = useState(params.get('provider') ?? '');
  const [sort, setSort] = useState('popularity');
  const [selected, setSelected] = useState<Product | null>(null);

  const query = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (category) searchParams.set('category', category);
    if (provider) searchParams.set('provider', provider);
    if (debouncedSearch) searchParams.set('q', debouncedSearch);
    searchParams.set('sort', sort);
    return searchParams.toString();
  }, [category, provider, debouncedSearch, sort]);

  const catalog = useAsync(
    () => api.get<{ items: Product[]; total: number; categories: CategorySummary[]; providers: ProviderSummary[] }>(`/products?${query}`),
    [query],
  );

  // Deep link: /shop?product=<id> opens the checkout drawer.
  useEffect(() => {
    const productId = params.get('product');
    if (!productId) return;
    api
      .get<{ product: Product }>(`/products/${productId}`)
      .then((result) => setSelected(result.product))
      .catch(() => undefined);
  }, [params]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('product');
    setParams(next, { replace: true });
  };

  const categories = catalog.data?.categories ?? [];
  const providers = catalog.data?.providers ?? [];
  const items = catalog.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
            <Sparkles className="size-3" /> NOVA
          </p>
          <h1 className="font-display text-3xl font-semibold text-white">{t('shop.title')}</h1>
          <p className="khmer mt-1 text-sm text-white/45">{t('shop.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="brand">{items.length} {t('shop.results')}</Badge>
          {user ? <Badge tone="gold">{user.wallet.points} {t('common.points')}</Badge> : null}
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              updateParam('q', event.target.value);
            }}
            placeholder={t('shop.search')}
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white placeholder:text-white/30 transition focus:border-brand-400/50 focus:bg-white/[0.07] focus:outline-none"
            aria-label={t('shop.search')}
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-ink-800 pl-9 pr-9 text-sm text-white/80 focus:outline-none sm:w-56"
            aria-label="Sort"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(option.key)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
        <button
          onClick={() => {
            setCategory('');
            updateParam('category', '');
          }}
          className={clsx(
            'shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition',
            !category
              ? 'border-brand-400/50 bg-brand-500/20 text-white'
              : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white',
          )}
        >
          {t('shop.all')}
        </button>
        {categories.map((entry) => (
          <button
            key={entry.category}
            onClick={() => {
              const next = category === entry.category ? '' : entry.category;
              setCategory(next);
              updateParam('category', next);
            }}
            className={clsx(
              'shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition',
              category === entry.category
                ? 'border-brand-400/50 bg-brand-500/20 text-white'
                : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white',
            )}
          >
            {pickText(entry.labelKm, entry.labelEn)}
            <span className="ml-1.5 text-[10px] text-white/30">{entry.count}</span>
          </button>
        ))}
      </div>

      {/* Provider chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-white/30">{pickText('បណ្តាញ', 'Provider')}</span>
        <button
          onClick={() => {
            setProvider('');
            updateParam('provider', '');
          }}
          className={clsx(
            'rounded-lg px-2.5 py-1 text-[11px] transition',
            !provider ? 'bg-white/12 text-white' : 'text-white/40 hover:bg-white/8 hover:text-white',
          )}
        >
          {t('shop.all')}
        </button>
        {providers.map((entry) => (
          <button
            key={entry.id}
            onClick={() => {
              const next = provider === entry.id ? '' : entry.id;
              setProvider(next);
              updateParam('provider', next);
            }}
            className={clsx(
              'rounded-lg px-2.5 py-1 text-[11px] transition',
              provider === entry.id ? 'bg-white/12 text-white' : 'text-white/40 hover:bg-white/8 hover:text-white',
            )}
          >
            {pickText(entry.km, entry.en)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {catalog.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-52" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} onBuy={setSelected} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<PackageSearch className="size-6" />}
          title={t('shop.empty')}
          body={t('shop.emptyBody')}
          action={
            <button
              onClick={() => {
                setSearch('');
                setCategory('');
                setProvider('');
                setParams({}, { replace: true });
              }}
              className="rounded-xl border border-white/12 px-4 py-2 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {t('common.retry')}
            </button>
          }
        />
      )}

      <CheckoutModal product={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />
    </div>
  );
}
