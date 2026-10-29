import { clsx } from 'clsx';
import { Copy, History, Receipt, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, relativeTime, shortDate } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import type { Order } from '../lib/types';
import { RiskMeter } from '../components/Charts';
import { Badge, Button, Card, EmptyState, Skeleton } from '../components/ui';

const STATUS_TONE: Record<string, 'mint' | 'gold' | 'rose' | 'neutral'> = {
  paid: 'mint',
  review: 'gold',
  refunded: 'rose',
  failed: 'neutral',
};

export function OrdersPage() {
  const { t, lang, pickText } = useI18n();
  const { user, loading } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);

  const orders = useAsync(
    () => api.get<{ items: Order[]; totals: { amountCents: number; orders: number } }>('/orders?limit=50'),
    [user?.id],
  );

  if (loading) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/auth?mode=signin&next=/orders" replace />;

  const items = orders.data?.items ?? [];
  const totals = orders.data?.totals ?? { amountCents: 0, orders: 0 };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
            <History className="size-3" /> NOVA
          </p>
          <h1 className="font-display text-3xl font-semibold text-white">{t('orders.title')}</h1>
          <p className="khmer mt-1 text-sm text-white/45">{t('orders.subtitle')}</p>
        </div>
        <Link to="/shop">
          <Button variant="secondary" size="sm" icon={<ShoppingBag className="size-3.5" />}>
            {t('home.ctaShop')}
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35">{t('orders.total')}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-white">{money(totals.amountCents)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35">{t('orders.count')}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-white">{totals.orders}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35">{t('wallet.points')}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-gold-300">{user.wallet.points}</p>
        </Card>
      </div>

      {orders.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : items.length ? (
        <div className="space-y-2.5">
          {items.map((order) => (
            <Card key={order.id} hover className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/25 to-aqua-400/10 text-white">
                    <Receipt className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {lang === 'km' ? order.productNameKm ?? order.productNameEn : order.productNameEn ?? order.productNameKm}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/35">
                      <span className="font-mono">{order.reference}</span>
                      <span>·</span>
                      <span>
                        {t('orders.recipient')}: <span className="font-mono">{order.recipient}</span>
                      </span>
                      <span>·</span>
                      <span>{shortDate(order.createdAt, lang)}</span>
                      {order.quantity > 1 ? (
                        <>
                          <span>·</span>
                          <span>x{order.quantity}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-white">{money(order.amountCents)}</p>
                    <p className="text-[10px] text-white/30">
                      +{order.pointsEarned} {t('common.points')}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[order.status] ?? 'neutral'}>
                    {t(`orders.status.${order.status}`)}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-3">
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-white/35">
                    <ShieldCheck className="size-3" />
                    {t('orders.risk')}
                  </span>
                  <RiskMeter score={order.riskScore} />
                  <span className="text-white/20">|</span>
                  <span className="inline-flex items-center gap-1 text-white/30">
                    <Truck className="size-3" />
                    {order.channel === 'assistant' ? pickText('តាម AI', 'via AI') : order.channel}
                  </span>
                </div>

                {order.deliveryCode ? (
                  <button
                    onClick={() => copy(order.deliveryCode!)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition',
                      copied === order.deliveryCode
                        ? 'border-mint-400/40 bg-mint-400/10 text-mint-400'
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-gold-400/40 hover:text-gold-300',
                    )}
                  >
                    {copied === order.deliveryCode ? t('common.copied') : order.deliveryCode}
                    <Copy className="size-3" />
                  </button>
                ) : order.status === 'review' ? (
                  <span className="text-[11px] text-gold-300">{t('checkout.review')}</span>
                ) : (
                  <span className="text-[11px] text-white/25">{relativeTime(order.createdAt, lang)}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<History className="size-6" />}
          title={t('orders.empty')}
          body={orders.error ?? t('orders.emptyBody')}
          action={
            <Link to="/shop">
              <Button>{t('home.ctaShop')}</Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
