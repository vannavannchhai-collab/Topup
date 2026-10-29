import { clsx } from 'clsx';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Gift,
  Landmark,
  Plus,
  Sparkles,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, relativeTime, thousands } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { Transaction } from '../lib/types';
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '../components/ui';

const PRESETS = [200, 500, 1000, 2500, 5000];

const TX_TONE: Record<string, 'mint' | 'rose' | 'gold' | 'brand'> = {
  deposit: 'mint',
  purchase: 'rose',
  refund: 'mint',
  points_redeem: 'gold',
};

const TX_LABEL: Record<string, [string, string]> = {
  deposit: ['បញ្ចូលប្រាក់', 'Deposit'],
  purchase: ['ទិញសេវា', 'Purchase'],
  refund: ['សងប្រាក់', 'Refund'],
  points_redeem: ['ប្តូរពិន្ទុ', 'Points redeemed'],
};

export function WalletPage() {
  const { t, lang, pickText } = useI18n();
  const { user, loading, updateWallet } = useAuth();
  const toast = useToast();

  const [amount, setAmount] = useState('5.00');
  const [method, setMethod] = useState('bakong');
  const [depositing, setDepositing] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const wallet = useAsync(
    () => api.get<{
      balanceCents: number;
      points: number;
      pointsValueCents: number;
      lifetimeInCents: number;
      lifetimeOutCents: number;
      depositMethods: { id: string; nameEn: string; nameKm: string; fee: number }[];
    }>('/wallet'),
    [user?.id],
  );

  const transactions = useAsync(
    () => api.get<{ items: Transaction[] }>('/wallet/transactions?limit=25'),
    [user?.id],
  );

  if (loading) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/auth?mode=signin&next=/wallet" replace />;

  const balance = wallet.data?.balanceCents ?? user.wallet.balanceCents;
  const points = wallet.data?.points ?? user.wallet.points;
  const methods = wallet.data?.depositMethods ?? [];
  const selectedMethod = methods.find((entry) => entry.id === method);
  const amountCents = Math.round(Number(amount || 0) * 100);
  const fee = selectedMethod?.fee ?? 0;

  const deposit = async () => {
    if (amountCents < 100) {
      toast.error(pickText('ចំនួនទឹកប្រាក់តូចពេក', 'Amount too small'));
      return;
    }
    setDepositing(true);
    try {
      const result = await api.post<{ balanceCents: number; creditedCents: number }>('/wallet/deposit', {
        amountCents,
        method,
      });
      updateWallet({ balanceCents: result.balanceCents, points });
      toast.success(`${money(result.creditedCents)} ${pickText('បានបញ្ចូល', 'added')}`, pickText('សមតុល្យថ្មី', 'New balance') + ` ${money(result.balanceCents)}`);
      wallet.reload();
      transactions.reload();
    } catch (cause) {
      toast.error(t('common.error'), cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setDepositing(false);
    }
  };

  const redeem = async () => {
    if (points < 100) return;
    setRedeeming(true);
    try {
      const result = await api.post<{ balanceCents: number; creditedCents: number; pointsRemaining: number }>(
        '/wallet/redeem-points',
        { points: Math.min(points, 100) },
      );
      updateWallet({ balanceCents: result.balanceCents, points: result.pointsRemaining });
      toast.success(`${money(result.creditedCents)} ${pickText('បានបន្ថែម', 'credited')}`);
      wallet.reload();
      transactions.reload();
    } catch (cause) {
      toast.error(t('common.error'), cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
          <WalletIcon className="size-3" /> NOVA
        </p>
        <h1 className="font-display text-3xl font-semibold text-white">{t('wallet.title')}</h1>
        <p className="khmer mt-1 text-sm text-white/45">{t('wallet.subtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* Balance hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/35 via-brand-500/15 to-aqua-400/10 p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-aqua-400/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">{t('wallet.balance')}</p>
              <Badge tone="mint">
                <Sparkles className="size-3" /> {pickText('សកម្ម', 'Active')}
              </Badge>
            </div>
            <p className="mt-2 font-display text-4xl font-bold text-white sm:text-5xl">
              {money(balance)}
              <span className="ml-2 text-sm font-medium text-white/40">USD</span>
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                  <Gift className="size-3 text-gold-300" /> {t('wallet.points')}
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-gold-300">{thousands(points)}</p>
                <p className="text-[10px] text-white/30">
                  {t('wallet.pointsValue')} {money(points)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                  <TrendingUp className="size-3 text-mint-400" /> {t('wallet.spent')}
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-white">
                  {money(wallet.data?.lifetimeOutCents ?? 0)}
                </p>
                <p className="text-[10px] text-white/30">
                  {t('wallet.funded')} {money(wallet.data?.lifetimeInCents ?? 0)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" loading={redeeming} onClick={redeem} disabled={points < 100} icon={<Coins className="size-3.5" />}>
                {t('wallet.redeem')} · {t('wallet.redeemHint')}
              </Button>
              <Link to="/shop">
                <Button size="sm" variant="secondary" icon={<ArrowUpRight className="size-3.5" />}>
                  {t('nav.shop')}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Deposit */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Plus className="size-4 text-brand-300" /> {t('wallet.addFunds')}
          </h2>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount((preset / 100).toFixed(2))}
                  className={clsx(
                    'rounded-lg border px-2.5 py-1.5 font-mono text-xs transition',
                    Math.round(Number(amount) * 100) === preset
                      ? 'border-brand-400/50 bg-brand-500/20 text-white'
                      : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white',
                  )}
                >
                  ${(preset / 100).toFixed(0)}
                </button>
              ))}
            </div>

            <Input
              label={t('wallet.amount')}
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              className="font-mono"
            />

            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{t('wallet.method')}</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(methods.length
                  ? methods
                  : [{ id: 'bakong', nameEn: 'Bakong', nameKm: 'បាគង', fee: 0 }]
                ).map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setMethod(entry.id)}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11px] transition',
                      method === entry.id
                        ? 'border-brand-400/50 bg-brand-500/15 text-white'
                        : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white',
                    )}
                  >
                    <Landmark className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{lang === 'km' ? entry.nameKm : entry.nameEn}</span>
                    {entry.fee ? <span className="text-[9px] text-white/30">+{money(entry.fee)}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-[11px]">
              <div className="flex justify-between text-white/45">
                <span>{t('wallet.amount')}</span>
                <span className="font-mono">{money(amountCents || 0)}</span>
              </div>
              <div className="flex justify-between text-white/45">
                <span>{t('wallet.fee')}</span>
                <span className="font-mono">{money(fee)}</span>
              </div>
              <div className="flex justify-between border-t border-white/6 pt-1.5 font-semibold text-white">
                <span>{t('wallet.credited')}</span>
                <span className="font-mono">{money(Math.max(0, amountCents - fee))}</span>
              </div>
            </div>

            <Button className="w-full" loading={depositing} onClick={deposit}>
              {depositing ? t('wallet.depositing') : `${t('wallet.deposit')} · ${money(Math.max(0, amountCents - fee))}`}
            </Button>
          </div>
        </Card>
      </div>

      {/* Transactions */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white">{t('wallet.transactions')}</h2>
          <Badge tone="neutral">{transactions.data?.items.length ?? 0}</Badge>
        </div>

        {transactions.loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : transactions.data?.items.length ? (
          <ul className="divide-y divide-white/6">
            {transactions.data.items.map((transaction) => {
              const positive = transaction.amountCents > 0;
              const label = TX_LABEL[transaction.type] ?? [transaction.type, transaction.type];
              return (
                <li key={transaction.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]">
                  <div
                    className={clsx(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl',
                      positive ? 'bg-mint-400/10 text-mint-400' : 'bg-rose-400/10 text-rose-400',
                    )}
                  >
                    {positive ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">
                      {lang === 'km' ? label[0] : label[1]}
                      <span className="ml-1.5 font-normal text-white/35">{transaction.description}</span>
                    </p>
                    <p className="text-[10px] text-white/30">
                      {relativeTime(transaction.createdAt, lang)}
                      {transaction.reference ? ` · ${transaction.reference}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={clsx('font-mono text-xs font-semibold', positive ? 'text-mint-400' : 'text-white/80')}>
                      {positive ? '+' : ''}
                      {money(transaction.amountCents)}
                    </p>
                    <p className="font-mono text-[10px] text-white/25">{money(transaction.balanceAfterCents)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-6">
            <EmptyState icon={<WalletIcon className="size-6" />} title={t('wallet.noTx')} />
          </div>
        )}
      </Card>
    </div>
  );
}
