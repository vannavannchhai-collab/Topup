import { clsx } from 'clsx';
import { CheckCircle2, Copy, Loader2, Minus, Plus, ShieldAlert, ShieldCheck, Truck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { Order, Product, RiskAssessment } from '../lib/types';
import { Badge, Button, Input, Modal, Progress } from './ui';

interface PurchaseResponse {
  order: Order;
  wallet: { balanceCents: number; points: number };
  risk: RiskAssessment;
  replayed?: boolean;
}

const idempotencyKey = () => `web_${crypto.randomUUID()}`;

export function CheckoutModal({
  product,
  open,
  onClose,
  onPurchased,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onPurchased?: (order: Order) => void;
}) {
  const { t, pick, pickText, lang } = useI18n();
  const { user, updateWallet } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [recipient, setRecipient] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const [discount, setDiscount] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const keyRef = useRef(idempotencyKey());

  useEffect(() => {
    if (open) {
      setRecipient(user?.phone ?? '');
      setQuantity(1);
      setRisk(null);
      setPreviewAmount(null);
      setResult(null);
      setError(null);
      keyRef.current = idempotencyKey();
    }
  }, [open, user?.phone]);

  const digits = recipient.replace(/\D/g, '');
  const validRecipient = digits.length >= 8;

  useEffect(() => {
    if (!open || !product || !user || !validRecipient) {
      setRisk(null);
      setPreviewAmount(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    const timer = window.setTimeout(() => {
      api
        .post<{ amountCents: number; discountRate: number; risk: RiskAssessment }>('/orders/preview', {
          productId: product.id,
          recipient,
          quantity,
        })
        .then((preview) => {
          if (cancelled) return;
          setRisk(preview.risk);
          setPreviewAmount(preview.amountCents);
          setDiscount(preview.discountRate);
        })
        .catch(() => {
          if (!cancelled) setRisk(null);
        })
        .finally(() => {
          if (!cancelled) setLoadingPreview(false);
        });
    }, 380);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, product, user, recipient, quantity, validRecipient]);

  const unit = product?.priceCents ?? 0;
  const subtotal = useMemo(() => Math.round(unit * quantity), [unit, quantity]);
  const total = previewAmount ?? Math.round(subtotal * (1 - discount));
  const balance = user?.wallet.balanceCents ?? 0;
  const insufficient = total > balance;

  if (!product) return null;

  const submit = async () => {
    if (!user) {
      navigate('/auth?mode=signin');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const response = await api.post<PurchaseResponse>('/orders', {
        productId: product.id,
        recipient,
        quantity,
        channel: 'web',
        idempotencyKey: keyRef.current,
      });
      setResult(response);
      updateWallet({ balanceCents: response.wallet.balanceCents, points: response.wallet.points });
      onPurchased?.(response.order);
      if (response.order.status === 'review') {
        toast.info(t('checkout.review'));
      } else {
        toast.success(t('checkout.success'), `${response.order.reference} · ${money(response.order.amountCents)}`);
      }
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Purchase failed';
      setError(message);
      toast.error(t('common.error'), message);
    } finally {
      setPaying(false);
    }
  };

  const copyCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const bandTone = risk?.band === 'low' ? 'mint' : risk?.band === 'review' ? 'gold' : 'rose';
  const bandLabel = risk?.band === 'low' ? t('risk.low') : risk?.band === 'review' ? t('risk.review') : t('risk.high');

  return (
    <Modal open={open} onClose={onClose} title={result ? undefined : t('checkout.title')}>
      {result ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-mint-400/12">
            <CheckCircle2 className="size-8 text-mint-400" />
          </div>
          <h3 className="font-display text-xl font-semibold text-white">
            {result.order.status === 'review' ? t('orders.status.review') : t('checkout.success')}
          </h3>
          <p className="khmer mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/50">
            {result.order.status === 'review' ? t('checkout.review') : t('checkout.successBody')}
          </p>

          <div className="mt-5 space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left">
            <Row label={pickText('លេខយោង', 'Reference')} value={result.order.reference} mono />
            <Row label={pickText('អ្នកទទួល', 'Recipient')} value={result.order.recipient} mono />
            <Row label={pickText('សរុប', 'Total')} value={money(result.order.amountCents)} mono />
            {result.order.deliveryCode ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] uppercase tracking-wider text-white/35">{t('checkout.deliveryCode')}</span>
                <button
                  onClick={() => copyCode(result.order.deliveryCode!)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold-400/12 px-2.5 py-1 font-mono text-xs text-gold-300 transition hover:bg-gold-400/20"
                >
                  {result.order.deliveryCode}
                  <Copy className="size-3" />
                </button>
              </div>
            ) : null}
            {copied ? <p className="text-right text-[10px] text-mint-400">{t('common.copied')}</p> : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                onClose();
              }}
            >
              {t('checkout.keepShopping')}
            </Button>
            <Link to="/orders">
              <Button icon={<Truck className="size-4" />}>{t('checkout.viewOrders')}</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/30 to-aqua-400/15 text-sm font-bold text-white">
              {product.provider.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{pick(product)}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-white/40">
                {pickText(product.descriptionKm, product.descriptionEn)}
              </p>
            </div>
            <span className="font-display text-base font-semibold text-white">{money(product.priceCents)}</span>
          </div>

          <Input
            label={t('checkout.recipient')}
            hint={t('checkout.recipientHint')}
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            inputMode="tel"
            placeholder="012 345 678"
            autoFocus
          />

          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{t('checkout.quantity')}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Decrease"
              >
                <Minus className="size-4" />
              </button>
              <input
                value={quantity}
                onChange={(event) => {
                  const next = Number(event.target.value.replace(/\D/g, ''));
                  setQuantity(Math.min(100, Math.max(1, next || 1)));
                }}
                className="h-10 w-16 rounded-xl border border-white/10 bg-white/5 text-center font-mono text-sm text-white focus:outline-none"
                aria-label={t('checkout.quantity')}
              />
              <button
                onClick={() => setQuantity((value) => Math.min(100, value + 1))}
                className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Increase"
              >
                <Plus className="size-4" />
              </button>
              {quantity >= 10 ? (
                <Badge tone="mint">-{Math.round(discount * 100)}% {pickText('បញ្ចុះតម្លៃដុំ', 'bulk discount')}</Badge>
              ) : (
                <span className="text-[10px] text-white/30">
                  {pickText('ទិញ 10+ ដើម្បីបញ្ចុះតម្លៃ', 'Buy 10+ for a bulk discount')}
                </span>
              )}
            </div>
          </div>

          {risk ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {risk.band === 'low' ? (
                    <ShieldCheck className="size-4 text-mint-400" />
                  ) : (
                    <ShieldAlert className={clsx('size-4', risk.band === 'review' ? 'text-gold-300' : 'text-rose-400')} />
                  )}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{t('checkout.riskTitle')}</span>
                </div>
                <Badge tone={bandTone as 'mint' | 'gold' | 'rose'}>{bandLabel}</Badge>
              </div>
              <div className="mt-2.5">
                <Progress value={risk.score} tone={risk.band === 'low' ? 'mint' : risk.band === 'review' ? 'gold' : 'rose'} />
              </div>
              <p className="khmer mt-2 text-[11px] leading-relaxed text-white/45">
                {lang === 'km' ? risk.explanationKm : risk.explanationEn}
              </p>
            </div>
          ) : loadingPreview ? (
            <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-[11px] text-white/40">
              <Loader2 className="size-3.5 animate-spin" />
              {t('checkout.riskTitle')}...
            </div>
          ) : null}

          <div className="space-y-1.5 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 text-xs">
            <div className="flex justify-between text-white/50">
              <span>{t('checkout.subtotal')}</span>
              <span className="font-mono">{money(subtotal)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between text-mint-400">
                <span>{t('checkout.discount')}</span>
                <span className="font-mono">-{money(subtotal - total)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-white/6 pt-1.5 text-sm font-semibold text-white">
              <span>{t('checkout.total')}</span>
              <span className="font-mono">{money(total)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-white/35">
              <span>{t('checkout.balance')}</span>
              <span className={clsx('font-mono', insufficient && 'text-rose-400')}>{money(balance)}</span>
            </div>
          </div>

          {error ? <p className="text-xs text-rose-400">{error}</p> : null}

          {!user ? (
            <Link to="/auth?mode=signin">
              <Button className="w-full" size="lg">{t('assistant.signInPrompt')}</Button>
            </Link>
          ) : insufficient ? (
            <div className="space-y-2">
              <Button variant="gold" size="lg" className="w-full" onClick={() => navigate('/wallet')}>
                {pickText('បញ្ចូលប្រាក់ក្នុងកាបូប', 'Add funds to wallet')}
              </Button>
              <p className="text-center text-[11px] text-white/35">
                {pickText('ត្រូវការបន្ថែម', 'You need')} {money(total - balance)} {pickText('បន្ថែមទៀត', 'more')}
              </p>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full"
              loading={paying}
              disabled={!validRecipient || (risk?.decision === 'block' && risk.band === 'high')}
              onClick={submit}
            >
              {paying ? t('checkout.paying') : `${t('checkout.pay')} · ${money(total)}`}
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] uppercase tracking-wider text-white/35">{label}</span>
      <span className={clsx('text-xs text-white/85', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
