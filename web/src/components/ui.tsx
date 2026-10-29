import { clsx } from 'clsx';
import { Loader2, X } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-brand-500 via-brand-400 to-aqua-400 text-ink-950 font-semibold shadow-[0_14px_40px_-14px_rgba(109,94,248,0.9)] hover:brightness-110 active:brightness-95',
  secondary:
    'bg-white/8 text-white border border-white/12 hover:bg-white/14 hover:border-white/20',
  ghost: 'text-white/70 hover:text-white hover:bg-white/8',
  gold: 'bg-gradient-to-r from-gold-400 to-gold-300 text-ink-950 font-semibold hover:brightness-105',
  danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-5 text-sm rounded-2xl gap-2',
  lg: 'h-13 px-7 text-base rounded-2xl gap-2.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function Card({
  children,
  className,
  hover,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={clsx(
        'glass rounded-3xl',
        hover && 'card-hover',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'gold' | 'mint' | 'rose' | 'aqua';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-white/8 text-white/70 border-white/12',
    brand: 'bg-brand-500/18 text-brand-200 border-brand-400/30',
    gold: 'bg-gold-400/15 text-gold-300 border-gold-400/30',
    mint: 'bg-mint-400/12 text-mint-400 border-mint-400/25',
    rose: 'bg-rose-400/12 text-rose-400 border-rose-400/25',
    aqua: 'bg-aqua-400/12 text-aqua-400 border-aqua-400/25',
  } as const;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }>(
  function Input({ label, hint, className, ...props }, ref) {
    return (
      <label className="block">
        {label ? <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{label}</span> : null}
        <input
          ref={ref}
          className={clsx(
            'h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/30',
            'transition focus:border-brand-400/60 focus:bg-white/8 focus:outline-none',
            className,
          )}
          {...props}
        />
        {hint ? <span className="mt-1 block text-[11px] text-white/35">{hint}</span> : null}
      </label>
    );
  },
);

export function Select({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{label}</span> : null}
      <select
        className={clsx(
          'h-11 w-full appearance-none rounded-xl border border-white/10 bg-ink-800 px-4 text-sm text-white',
          'transition focus:border-brand-400/60 focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  size?: 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'glass-strong relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl p-6 shadow-2xl animate-rise sm:rounded-3xl',
          size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-3xl',
        )}
      >
        {title ? (
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">{eyebrow}</p>
        ) : null}
        <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1.5 max-w-xl text-sm text-white/50">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/5 text-brand-300">{icon}</div>
      <p className="text-base font-semibold text-white">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-white/45">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Progress({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'mint' | 'rose' | 'gold' }) {
  const tones = {
    brand: 'from-brand-500 to-aqua-400',
    mint: 'from-mint-400 to-aqua-400',
    rose: 'from-rose-400 to-orange-400',
    gold: 'from-gold-400 to-orange-300',
  } as const;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-700', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="animate-aurora absolute -left-40 -top-40 size-[36rem] rounded-full bg-brand-600/25 blur-[120px]" />
      <div className="animate-aurora absolute -right-32 top-16 size-[30rem] rounded-full bg-aqua-500/15 blur-[120px] [animation-delay:-6s]" />
      <div className="animate-aurora absolute bottom-0 left-1/3 size-[34rem] rounded-full bg-gold-400/8 blur-[130px] [animation-delay:-11s]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_55%)]" />
    </div>
  );
}
