import { clsx } from 'clsx';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  ChevronRight,
  BrainCircuit,
  ChartSpline,
  Coins,
  Cpu,
  Gamepad2,
  Landmark,
  Languages,
  Lightbulb,
  Receipt,
  Send,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Signal,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import type { CategorySummary, Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { Badge, Button, Card, SectionHeading, Skeleton } from '../components/ui';
import { Sparkbars } from '../components/Charts';

const CATEGORY_ICON: Record<string, typeof Signal> = {
  mobile: Signal,
  data: Zap,
  gaming: Gamepad2,
  bills: Receipt,
  entertainment: Coins,
  esim: Languages,
};

const CATEGORY_GRADIENT: Record<string, string> = {
  mobile: 'from-rose-500/20 to-orange-400/5 text-rose-200',
  data: 'from-aqua-400/20 to-brand-500/5 text-aqua-300',
  gaming: 'from-violet-500/20 to-fuchsia-400/5 text-violet-200',
  bills: 'from-amber-400/20 to-gold-300/5 text-amber-200',
  entertainment: 'from-emerald-400/20 to-teal-300/5 text-emerald-200',
  esim: 'from-sky-400/20 to-brand-400/5 text-sky-200',
};

export function HomePage() {
  const { t, pickText } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');

  const catalog = useAsync(
    () => api.get<{ items: Product[]; categories: CategorySummary[] }>('/products?sort=popularity'),
    [],
  );
  const recommendations = useAsync(
    () => api.get<{ items: Product[]; personalized: boolean }>('/products/recommendations?limit=6'),
    [user?.id],
  );

  const insights = useAsync(
    () => (user ? api.get<{ insights: Insight[] }>('/insights') : Promise.resolve({ insights: [] as Insight[] })),
    [user?.id],
  );

  const categories = catalog.data?.categories ?? [];
  const products = recommendations.data?.items ?? catalog.data?.items.slice(0, 6) ?? [];
  const personalized = recommendations.data?.personalized ?? false;

  const submitPrompt = (event: React.FormEvent) => {
    event.preventDefault();
    const value = prompt.trim();
    navigate(value ? `/assistant?q=${encodeURIComponent(value)}` : '/assistant');
  };

  return (
    <div className="space-y-20">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-4xl border border-white/8 bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent p-6 sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/25 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-28 right-24 size-64 rounded-full bg-aqua-400/15 blur-[90px]" />

        <div className="relative grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-500/10 px-3 py-1 text-[11px] font-medium text-brand-200">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-aqua-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-aqua-400" />
              </span>
              {t('home.eyebrow')}
            </div>

            <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.2rem]">
              <span className="block text-white">{t('home.title1')}</span>
              <span className="text-gradient block">{t('home.title2')}</span>
            </h1>

            <p className="khmer mt-5 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">{t('home.sub')}</p>

            <form onSubmit={submitPrompt} className="mt-7 max-w-xl">
              <div className="ring-gradient flex items-center gap-2 rounded-2xl bg-ink-850/80 p-1.5 pl-3 shadow-xl">
                <Sparkles className="size-4 shrink-0 text-brand-300" />
                <input
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={t('home.askPlaceholder')}
                  className="khmer h-10 flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                  aria-label={t('home.askPlaceholder')}
                />
                <Button type="submit" size="sm" icon={<Send className="size-3.5" />} className="shrink-0">
                  {t('home.ctaAsk')}
                </Button>
              </div>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/shop">
                <Button size="md" icon={<ArrowRight className="size-4" />}>{t('home.ctaShop')}</Button>
              </Link>
              <Link
                to="/shop?category=data"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/12 px-5 text-sm text-white/75 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
              >
                <Zap className="size-4 text-aqua-300" />
                {pickText('កញ្ចប់អ៊ីនធឺណិត', 'Data bundles')}
              </Link>
            </div>

            <dl className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { value: '392+', label: t('home.statOrders') },
                { value: '8.4s', label: t('home.statDelivery') },
                { value: '99.98%', label: t('home.statUptime') },
                { value: '94%', label: t('home.statAccuracy') },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="font-display text-xl font-semibold text-white sm:text-2xl">{stat.value}</dt>
                  <dd className="mt-0.5 text-[11px] leading-tight text-white/35">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Floating AI console preview */}
          <div className="relative">
            <div className="animate-float">
              <Card className="relative overflow-hidden p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-aqua-400">
                      <Bot className="size-4 text-ink-950" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-white">NOVA AI</p>
                      <p className="text-[10px] text-mint-400">● {pickText('អនឡាញ', 'online')}</p>
                    </div>
                  </div>
                  <Badge tone="brand">{pickText('ផ្អែកលើទិន្នន័យ', 'grounded')}</Badge>
                </div>

                <div className="space-y-2.5">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500/20 px-3 py-2 text-[11px] text-white/85">
                    {pickText('កញ្ចប់អ៊ីនធឺណិតណាល្អសម្រាប់សប្តាហ៍នេះ?', 'Which data bundle fits this week?')}
                  </div>
                  <div className="rounded-2xl rounded-bl-sm border border-white/8 bg-white/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-white/70">
                    <p className="mb-1.5 font-semibold text-white">
                      {pickText('Smart 10GB / 7 ថ្ងៃ — $2.20', 'Smart 10GB / 7 days — $2.20')}
                    </p>
                    <p className="text-white/50">
                      {pickText(
                        'ស្របនឹងថវិកាធម្មតារបស់អ្នក $2.10 និងមាន 5G នៅសៀមរាប។',
                        'Matches your usual $2.10 spend and includes 5G in Siem Reap.',
                      )}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Badge tone="aqua">5G</Badge>
                      <Badge tone="brand">10 GB</Badge>
                      <Badge tone="mint">{pickText('សន្សំ 12%', 'save 12%')}</Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/8 bg-ink-900/60 p-3">
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/35">
                    <span>{t('admin.forecast')}</span>
                    <span className="text-aqua-300">{pickText('៧ ថ្ងៃ', '7 days')}</span>
                  </div>
                  <Sparkbars
                    data={[
                      { date: '1', value: 12 },
                      { date: '2', value: 18 },
                      { date: '3', value: 15 },
                      { date: '4', value: 22 },
                      { date: '5', value: 28 },
                      { date: '6', value: 24 },
                      { date: '7', value: 31 },
                    ]}
                  />
                </div>
              </Card>
            </div>

            <div className="absolute -bottom-6 -left-4 hidden w-52 rounded-2xl border border-white/10 bg-ink-850/90 p-3 shadow-xl backdrop-blur sm:block">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-mint-400" />
                <p className="text-[11px] font-semibold text-white">{t('checkout.riskTitle')}</p>
              </div>
              <p className="mt-1 text-[10px] text-white/40">{pickText('ហានិភ័យទាប · អនុម័តភ្លាមៗ', 'Low risk · auto-approved')}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[14%] rounded-full bg-gradient-to-r from-mint-400 to-aqua-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          eyebrow={pickText('សេវាទាំងអស់', 'All services')}
          title={t('home.categories')}
          subtitle={t('home.categoriesSub')}
          action={
            <Link to="/shop" className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 transition hover:text-white">
              {t('common.viewAll')} <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {catalog.loading
            ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28" />)
            : categories.map((category) => {
                const Icon = CATEGORY_ICON[category.category] ?? Signal;
                return (
                  <Link
                    key={category.category}
                    to={`/shop?category=${category.category}`}
                    className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/[0.06]"
                  >
                    <div
                      className={clsx(
                        'mb-3 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br',
                        CATEGORY_GRADIENT[category.category] ?? 'from-white/15 to-white/5 text-white',
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <p className="text-xs font-semibold text-white">{pickText(category.labelKm, category.labelEn)}</p>
                    <p className="mt-0.5 text-[10px] text-white/35">
                      {category.count} {pickText('ផលិតផល', 'products')}
                    </p>
                    <ArrowRight className="absolute right-3 top-3 size-3.5 -translate-x-1 text-white/0 transition group-hover:translate-x-0 group-hover:text-white/40" />
                  </Link>
                );
              })}
        </div>
      </section>

      {/* ── Recommendations ─────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          eyebrow={personalized ? pickText('ផ្ទាល់ខ្លួន · AI', 'Personalised · AI') : pickText('ពេញនិយម', 'Trending')}
          title={t('home.recommended')}
          subtitle={t('home.recommendedSub')}
          action={
            <Link to="/shop" className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 transition hover:text-white">
              {t('common.viewAll')} <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.loading && !products.length
            ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56" />)
            : products.slice(0, 6).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onBuy={() => navigate(`/shop?product=${product.id}`)}
                />
              ))}
        </div>
      </section>

      {/* ── Personal insights ───────────────────────────────────────────── */}
      {user && insights.data?.insights.length ? (
        <section>
          <SectionHeading
            eyebrow={pickText('ការវិភាគ AI', 'AI analytics')}
            title={pickText('ការយល់ដឹងអំពីអ្នក', 'Insights about you')}
            subtitle={pickText(
              'គណនាពីការបញ្ជាទិញពិតរបស់អ្នក — មិនមែនការទាយទេ។',
              'Computed from your real orders — not guesses.',
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {insights.data.insights.map((insight) => {
              const tone =
                insight.tone === 'win'
                  ? 'border-mint-400/25 from-mint-400/10'
                  : insight.tone === 'warning'
                    ? 'border-rose-400/25 from-rose-400/10'
                    : insight.tone === 'tip'
                      ? 'border-brand-400/25 from-brand-500/10'
                      : 'border-white/10 from-white/[0.04]';
              const Icon =
                insight.tone === 'win' ? TrendingUp : insight.tone === 'warning' ? TrendingDown : insight.tone === 'tip' ? Lightbulb : Sparkles;
              return (
                <Link
                  key={insight.id}
                  to={insight.actionRoute ?? '/shop'}
                  className={clsx(
                    'group relative overflow-hidden rounded-3xl border bg-gradient-to-br to-transparent p-5 transition hover:-translate-y-0.5 hover:border-white/25',
                    tone,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-xl bg-white/8 text-white/80">
                        <Icon className="size-4" />
                      </span>
                      <p className="text-sm font-semibold text-white">
                        {pickText(insight.titleKm, insight.titleEn)}
                      </p>
                    </div>
                    {insight.metric ? <Badge tone="neutral">{insight.metric}</Badge> : null}
                  </div>
                  <p className="khmer mt-2.5 text-xs leading-relaxed text-white/50">
                    {pickText(insight.bodyKm, insight.bodyEn)}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-brand-300 transition group-hover:text-white">
                    {pickText('មើលបន្ថែម', 'Take action')}
                    <ChevronRight className="size-3" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section>
        <SectionHeading eyebrow={pickText('ដំណើរការ', 'The flow')} title={t('home.howTitle')} />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: BrainCircuit, title: t('home.step1Title'), body: t('home.step1Body'), step: '01' },
            { icon: Lightbulb, title: t('home.step2Title'), body: t('home.step2Body'), step: '02' },
            { icon: BadgeCheck, title: t('home.step3Title'), body: t('home.step3Body'), step: '03' },
          ].map((step) => (
            <Card key={step.step} hover className="relative overflow-hidden p-6">
              <span className="absolute right-5 top-4 font-display text-4xl font-bold text-white/5">{step.step}</span>
              <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-aqua-400/10 text-brand-200">
                <step.icon className="size-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-white">{step.title}</h3>
              <p className="khmer mt-2 text-xs leading-relaxed text-white/45">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading eyebrow={pickText('បច្ចេកវិទ្យា', 'Under the hood')} title={t('home.featureTitle')} />
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: Languages, title: t('home.feature1'), body: t('home.feature1Body') },
            { icon: ShieldCheck, title: t('home.feature2'), body: t('home.feature2Body') },
            { icon: ChartSpline, title: t('home.feature3'), body: t('home.feature3Body') },
            { icon: Wallet, title: t('home.feature4'), body: t('home.feature4Body') },
          ].map((feature) => (
            <Card key={feature.title} hover className="flex gap-4 p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-aqua-300">
                <feature.icon className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                <p className="khmer mt-1.5 text-xs leading-relaxed text-white/45">{feature.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-white/8 bg-gradient-to-r from-brand-500/10 via-transparent to-aqua-400/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/8 text-gold-300">
              <Landmark className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{t('home.trustTitle')}</p>
              <p className="text-xs text-white/45">{t('home.trustLine')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
            <Badge tone="mint"><Cpu className="size-3" /> AI risk engine</Badge>
            <Badge tone="brand"><ShieldCheck className="size-3" /> scrypt + JWT</Badge>
            <Badge tone="gold"><Coins className="size-3" /> {pickText('ពិន្ទុរង្វាន់', 'Rewards')}</Badge>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      {!user ? (
        <section className="relative overflow-hidden rounded-4xl border border-brand-400/25 bg-gradient-to-br from-brand-600/30 via-brand-500/10 to-aqua-400/10 p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,211,238,0.25),transparent_60%)]" />
          <h2 className="relative font-display text-2xl font-semibold text-white sm:text-4xl">
            {pickText('ចាប់ផ្តើមជាមួយ NOVA ថ្ងៃនេះ', 'Start with NOVA today')}
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-sm text-white/60">
            {pickText(
              'បើកគណនីឥតគិតថ្លៃ ទទួលបាន $50 ឥណទានស្វាគមន៍ និងការណែនាំផ្ទាល់ខ្លួនពី AI។',
              'Create a free account, get $50 welcome credit and personalised AI recommendations.',
            )}
          </p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth?mode=signup">
              <Button size="lg" icon={<Sparkles className="size-4" />}>{t('nav.signUp')}</Button>
            </Link>
            <Link to="/shop">
              <Button size="lg" variant="secondary">{t('home.ctaShop')}</Button>
            </Link>
          </div>
          <p className="relative mt-4 text-[11px] text-white/35">
            {pickText('គណនីសាកល្បង', 'Demo')}: demo@nova.ai · Demo@1234 — {money(4250)} {pickText('សមតុល្យ', 'balance')}
          </p>
        </section>
      ) : null}
    </div>
  );
}

interface Insight {
  id: string;
  tone: 'info' | 'win' | 'warning' | 'tip';
  titleEn: string;
  titleKm: string;
  bodyEn: string;
  bodyKm: string;
  metric?: string;
  actionRoute?: string;
}
