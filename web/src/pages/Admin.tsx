import { clsx } from 'clsx';
import {
  BrainCircuit,
  ChartSpline,
  CircleDollarSign,
  Clock,
  Check,
  LayoutDashboard,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, shortDate, thousands } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { AdminMetrics, ForecastResult, Order } from '../lib/types';
import { BarList, ForecastChart, RiskMeter } from '../components/Charts';
import { Badge, Button, Card, Skeleton } from '../components/ui';

interface TopProduct {
  id: string;
  nameEn: string;
  nameKm: string;
  category: string;
  provider: string;
  units: number;
  revenueCents: number;
}

interface RiskItem extends Order {
  customer: { email: string; name: string };
}

export function AdminPage() {
  const { t, lang, pickText } = useI18n();
  const { user, loading } = useAuth();
  const toast = useToast();
  const [series, setSeries] = useState<'revenue' | 'orders'>('orders');
  const [acting, setActing] = useState<string | null>(null);

  const metrics = useAsync(() => api.get<AdminMetrics>('/admin/metrics'), [user?.id]);
  const forecast = useAsync(() => api.get<{ revenue: ForecastResult; orders: ForecastResult }>('/admin/forecast?horizon=7'), [user?.id]);
  const topProducts = useAsync(() => api.get<{ items: TopProduct[] }>('/admin/top-products'), [user?.id]);
  const riskQueue = useAsync(() => api.get<{ items: RiskItem[] }>('/admin/risk-queue'), [user?.id]);
  const customers = useAsync(
    () => api.get<{ items: { id: string; name: string; email: string; orders: number; spendCents: number; balanceCents: number; points: number }[] }>('/admin/customers'),
    [user?.id],
  );
  const assistantStats = useAsync(
    () => api.get<{ questions: number; averageLatencyMs: number; intents: { intent: string; count: number }[] }>('/admin/assistant-stats'),
    [user?.id],
  );

  if (loading) return <Skeleton className="h-64" />;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setActing(id);
    try {
      await api.post(`/admin/risk-queue/${id}/decision`, { action });
      toast.success(
        action === 'approve' ? pickText('បានអនុម័ត', 'Order approved') : pickText('បានបដិសេធ និងសងប្រាក់', 'Order rejected and refunded'),
      );
      riskQueue.reload();
      metrics.reload();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setActing(null);
    }
  };

  const active = forecast.data?.[series];
  const intentTotal = assistantStats.data?.intents.reduce((sum, entry) => sum + entry.count, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
            <LayoutDashboard className="size-3" /> NOVA
          </p>
          <h1 className="font-display text-3xl font-semibold text-white">{t('admin.title')}</h1>
          <p className="khmer mt-1 text-sm text-white/45">{t('admin.subtitle')}</p>
        </div>
        <Badge tone="mint">
          <span className="size-1.5 rounded-full bg-mint-400" /> live
        </Badge>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.loading || !metrics.data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24" />)
        ) : (
          [
            {
              label: t('admin.revenue'),
              value: money(metrics.data.revenueCents),
              icon: CircleDollarSign,
              hint: `${metrics.data.orderCount} ${t('admin.orders')}`,
              tone: 'text-mint-400',
            },
            {
              label: t('admin.gmvToday'),
              value: money(metrics.data.gmvTodayCents),
              icon: TrendingUp,
              hint: `${metrics.data.gmvGrowth > 0 ? '+' : ''}${metrics.data.gmvGrowth}% vs ${pickText('ម្សិលមិញ', 'yesterday')}`,
              tone: metrics.data.gmvGrowth >= 0 ? 'text-mint-400' : 'text-rose-400',
            },
            {
              label: t('admin.aov'),
              value: money(metrics.data.averageOrderCents),
              icon: ChartSpline,
              hint: `${metrics.data.newUsers7d} ${pickText('អតិថិជនថ្មី', 'new customers')}`,
              tone: 'text-brand-300',
            },
            {
              label: t('admin.reviewQueue'),
              value: String(metrics.data.reviewQueue),
              icon: ShieldAlert,
              hint: `${metrics.data.users} ${t('admin.users')}`,
              tone: metrics.data.reviewQueue > 0 ? 'text-gold-300' : 'text-white/60',
            },
          ].map((metric) => (
            <Card key={metric.label} hover className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-white/35">{metric.label}</p>
                <metric.icon className={clsx('size-4', metric.tone)} />
              </div>
              <p className="mt-2 font-display text-2xl font-semibold text-white">{metric.value}</p>
              <p className="mt-0.5 text-[10px] text-white/30">{metric.hint}</p>
            </Card>
          ))
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Forecast */}
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <ChartSpline className="size-4 text-aqua-300" /> {t('admin.forecast')}
              </h2>
              <p className="mt-0.5 text-[11px] text-white/35">{t('admin.forecastSub')}</p>
            </div>
            <div className="flex rounded-lg border border-white/10 p-0.5 text-[11px]">
              {(['orders', 'revenue'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSeries(option)}
                  className={clsx(
                    'rounded-md px-2.5 py-1 transition',
                    series === option ? 'bg-white/12 text-white' : 'text-white/45 hover:text-white',
                  )}
                >
                  {option === 'orders' ? t('admin.orders') : t('admin.revenue')}
                </button>
              ))}
            </div>
          </div>

          {active ? (
            <>
              <ForecastChart
                history={active.history}
                forecast={active.forecast}
                format={(value) => (series === 'revenue' ? money(value * 100) : String(value))}
              />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={active.errorMetric} value={`${active.errorPct}%`} tone={active.errorPct <= 30 ? 'text-mint-400' : 'text-gold-300'} />
                <Stat label={t('admin.baseline')} value={`${active.baselineErrorPct}%`} tone="text-white/60" />
                <Stat
                  label={t('admin.trend')}
                  value={`${active.trendPerDay >= 0 ? '+' : ''}${active.trendPerDay}${pickText('/ថ្ងៃ', '/day')}`}
                  tone={active.trendPerDay >= 0 ? 'text-mint-400' : 'text-rose-400'}
                />
                <Stat label={t('admin.confidence')} value={active.confidence} tone="text-brand-300" />
              </div>
              <p className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-2.5 font-mono text-[10px] leading-relaxed text-white/40">
                {active.model}
              </p>
            </>
          ) : (
            <Skeleton className="h-56" />
          )}
        </Card>

        {/* Risk queue */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldAlert className="size-4 text-gold-300" /> {t('admin.riskTitle')}
              </h2>
              <p className="mt-0.5 text-[11px] text-white/35">{t('admin.riskSub')}</p>
            </div>
            <Badge tone="gold">{riskQueue.data?.items.length ?? 0}</Badge>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {riskQueue.loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16" />
                ))}
              </div>
            ) : riskQueue.data?.items.length ? (
              <ul className="divide-y divide-white/6">
                {riskQueue.data.items.map((item) => (
                  <li key={item.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-white">
                          {lang === 'km' ? item.productNameKm : item.productNameEn}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-white/35">
                          {item.customer.name} · <span className="font-mono">{item.reference}</span>
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-white">{money(item.amountCents)}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <RiskMeter score={item.riskScore} />
                      {item.status === 'review' ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="!h-7 !rounded-lg !px-2 !text-[10px]"
                            loading={acting === item.id}
                            onClick={() => decide(item.id, 'approve')}
                            icon={<Check className="size-3" />}
                          >
                            {t('admin.approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="!h-7 !rounded-lg !px-2 !text-[10px]"
                            loading={acting === item.id}
                            onClick={() => decide(item.id, 'reject')}
                            icon={<X className="size-3" />}
                          >
                            {t('admin.reject')}
                          </Button>
                        </div>
                      ) : (
                        <Badge tone={item.status === 'paid' ? 'mint' : 'rose'}>{t(`orders.status.${item.status}`)}</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-xs text-white/35">{pickText('គ្មានការបញ្ជាទិញត្រូវពិនិត្យ', 'No orders need review')}</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top products */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="size-4 text-brand-300" /> {t('admin.topProducts')}
          </h2>
          {topProducts.data ? (
            <BarList
              items={topProducts.data.items.slice(0, 7).map((product) => ({
                label: lang === 'km' ? product.nameKm : product.nameEn,
                value: product.revenueCents,
                hint: `${product.units} ${pickText('ឯកតា', 'units')} · ${product.provider}`,
              }))}
            />
          ) : (
            <Skeleton className="h-40" />
          )}
        </Card>

        {/* Assistant stats */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <BrainCircuit className="size-4 text-aqua-300" /> {t('admin.assistant')}
          </h2>
          {assistantStats.data ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/35">{t('admin.questions')}</p>
                  <p className="font-display text-lg font-semibold text-white">{thousands(assistantStats.data.questions)}</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/35">
                    <Clock className="size-2.5" /> {t('admin.latency')}
                  </p>
                  <p className="font-display text-lg font-semibold text-white">
                    {assistantStats.data.averageLatencyMs || '—'}
                    <span className="ml-0.5 text-[10px] text-white/40">ms</span>
                  </p>
                </div>
              </div>
              <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">{t('admin.intents')}</p>
              <div className="space-y-2">
                {assistantStats.data.intents.slice(0, 6).map((entry) => (
                  <div key={entry.intent}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-white/60">{entry.intent}</span>
                      <span className="font-mono text-white/35">{Math.round((entry.count / intentTotal) * 100)}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/6">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-aqua-400"
                        style={{ width: `${(entry.count / intentTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Skeleton className="h-40" />
          )}
        </Card>

        {/* Customers */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Users className="size-4 text-brand-300" /> {t('admin.customers')}
            </h2>
          </div>
          <div className="max-h-[20rem] overflow-y-auto">
            {customers.data ? (
              <ul className="divide-y divide-white/6">
                {customers.data.items.slice(0, 8).map((customer) => (
                  <li key={customer.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500/50 to-aqua-400/40 text-[10px] font-bold text-white">
                      {customer.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-white">{customer.name}</p>
                      <p className="truncate text-[10px] text-white/30">
                        {customer.orders} {t('admin.orders')} · {money(customer.balanceCents)}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-white/70">{money(customer.spendCents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10" />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <p className="text-center text-[10px] text-white/25">
        {pickText('ទិន្នន័យចាប់ពី', 'Data since')} {metrics.data ? shortDate(new Date(Date.now() - 45 * 86400000).toISOString(), lang) : '—'} ·{' '}
        <Link to="/assistant" className="text-brand-300 hover:text-white">
          {t('admin.assistant')}
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
      <p className={clsx('mt-0.5 font-display text-sm font-semibold capitalize', tone)}>{value}</p>
    </div>
  );
}
