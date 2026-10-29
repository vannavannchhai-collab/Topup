import { clsx } from 'clsx';
import { ArrowUpRight, CalendarDays, Database, Sparkles, Star } from 'lucide-react';
import { money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { Product } from '../lib/types';
import { Badge } from './ui';

const PROVIDER_STYLE: Record<string, { bg: string; label: string }> = {
  cellcard: { bg: 'from-rose-500/30 to-orange-400/20 text-rose-200', label: 'C' },
  smart: { bg: 'from-emerald-500/30 to-teal-400/20 text-emerald-200', label: 'S' },
  metfone: { bg: 'from-sky-500/30 to-cyan-400/20 text-sky-200', label: 'M' },
  seatel: { bg: 'from-violet-500/30 to-fuchsia-400/20 text-violet-200', label: 'Se' },
  edc: { bg: 'from-amber-500/30 to-yellow-400/20 text-amber-200', label: 'E' },
  ppwsa: { bg: 'from-cyan-500/30 to-blue-400/20 text-cyan-200', label: 'W' },
  isp: { bg: 'from-indigo-500/30 to-sky-400/20 text-indigo-200', label: 'Net' },
  moonton: { bg: 'from-blue-500/30 to-indigo-400/20 text-blue-200', label: 'ML' },
  garena: { bg: 'from-orange-500/30 to-red-400/20 text-orange-200', label: 'G' },
  netflix: { bg: 'from-red-500/30 to-rose-400/20 text-red-200', label: 'N' },
  spotify: { bg: 'from-green-500/30 to-emerald-400/20 text-green-200', label: 'Sp' },
  google: { bg: 'from-yellow-500/25 to-blue-400/20 text-yellow-200', label: 'GP' },
  nova: { bg: 'from-brand-500/35 to-aqua-400/20 text-brand-200', label: 'NV' },
};

export function ProductCard({
  product,
  onBuy,
  compact,
}: {
  product: Product;
  onBuy: (product: Product) => void;
  compact?: boolean;
}) {
  const { pick, pickText, t } = useI18n();
  const style = PROVIDER_STYLE[product.provider] ?? { bg: 'from-white/15 to-white/5 text-white', label: product.provider.slice(0, 2) };
  const saving = product.faceValueCents > product.priceCents
    ? Math.round(((product.faceValueCents - product.priceCents) / product.faceValueCents) * 100)
    : 0;
  const reason = pickText(product.reasonsKm?.[0] ?? '', product.reasonsEn?.[0] ?? '');

  const badgeTone = product.badge === 'Top seller' || product.badge === 'Best value'
    ? 'gold'
    : product.badge === 'New'
      ? 'aqua'
      : 'brand';

  const badgeLabel = product.badge
    ? product.badge === 'Popular'
      ? t('shop.popular')
      : product.badge === 'New'
        ? t('shop.new')
        : product.badge === 'Best value'
          ? t('shop.bestValue')
          : product.badge === 'Top seller'
            ? t('shop.topSeller')
            : product.badge
    : null;

  return (
    <div
      className={clsx(
        'group flex flex-col overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 card-hover',
        compact && 'p-3.5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={clsx(
              'flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold uppercase tracking-tight',
              style.bg,
            )}
          >
            {style.label}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-white/35">{product.provider}</p>
            <p className="truncate text-sm font-semibold text-white">{pick(product)}</p>
          </div>
        </div>
        {badgeLabel ? <Badge tone={badgeTone}>{badgeLabel}</Badge> : null}
      </div>

      {!compact ? (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/45">
          {pickText(product.descriptionKm, product.descriptionEn)}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {product.dataGb ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-aqua-400/10 px-2 py-1 text-[11px] font-medium text-aqua-300">
            <Database className="size-3" />
            {product.dataGb} GB
          </span>
        ) : null}
        {product.validityDays ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/6 px-2 py-1 text-[11px] text-white/55">
            <CalendarDays className="size-3" />
            {product.validityDays} {pickText('ថ្ងៃ', 'days')}
          </span>
        ) : null}
        {saving > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-mint-400/10 px-2 py-1 text-[11px] font-medium text-mint-400">
            <Star className="size-3" />-{saving}%
          </span>
        ) : null}
      </div>

      {reason ? (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-brand-200/80">
          <Sparkles className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-1">{reason}</span>
        </p>
      ) : null}

      <div className="mt-4 flex items-end justify-between gap-2 border-t border-white/6 pt-3">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-semibold text-white">{money(product.priceCents)}</span>
            {saving > 0 ? (
              <span className="text-xs text-white/30 line-through">{money(product.faceValueCents)}</span>
            ) : null}
          </div>
          <p className="text-[10px] uppercase tracking-wider text-white/30">
            {product.category === 'bills' ? pickText('បង់វិក្កយបត្រ', 'Bill payment') : pickText('ដឹកជញ្ជូនភ្លាមៗ', 'Instant delivery')}
          </p>
        </div>
        <button
          onClick={() => onBuy(product)}
          className="inline-flex items-center gap-1 rounded-xl bg-white/8 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-500 hover:text-ink-950"
        >
          {t('shop.buy')}
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
