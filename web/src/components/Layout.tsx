import { clsx } from 'clsx';
import {
  BadgeDollarSign,
  Bot,
  CircleHelp,
  Coins,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ShoppingBag,
  Sparkles,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { Aurora, Badge } from './ui';

const NAV = [
  { to: '/', key: 'nav.home', icon: Home },
  { to: '/shop', key: 'nav.shop', icon: ShoppingBag },
  { to: '/assistant', key: 'nav.assistant', icon: Bot, highlight: true },
  { to: '/wallet', key: 'nav.wallet', icon: WalletIcon },
  { to: '/orders', key: 'nav.orders', icon: History },
];

const MOBILE_NAV = [...NAV, { to: '/help', key: 'nav.help', icon: CircleHelp }];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-aqua-400 shadow-lg shadow-brand-600/30">
        <span className="font-display text-sm font-bold text-ink-950">N</span>
        <span className="absolute inset-0 animate-pulse-ring rounded-xl bg-brand-400/40" />
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold tracking-tight text-white">NOVA</span>
          <span className="text-[9px] uppercase tracking-[0.22em] text-white/35">AI Super App</span>
        </span>
      ) : null}
    </Link>
  );
}

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-semibold">
      {(['km', 'en'] as const).map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={clsx(
            'rounded-full px-2.5 py-1 transition',
            lang === code ? 'bg-white text-ink-950' : 'text-white/50 hover:text-white',
          )}
        >
          {code === 'km' ? 'ខ្មែរ' : 'EN'}
        </button>
      ))}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [...NAV];
  if (user?.role === 'admin') navItems.push({ to: '/admin', key: 'nav.admin', icon: LayoutDashboard });
  navItems.push({ to: '/help', key: 'nav.help', icon: CircleHelp });

  return (
    <div className="min-h-dvh">
      <Aurora />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/8 bg-ink-900/70 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="px-2">
          <Logo />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                  isActive
                    ? 'bg-gradient-to-r from-brand-500/20 to-transparent text-white shadow-[inset_1px_0_0_0_rgba(139,132,255,0.9)]'
                    : 'text-white/50 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={clsx('size-4.5 transition', isActive ? 'text-brand-300' : 'text-white/40 group-hover:text-white/80')} />
                  <span className="flex-1">{t(item.key)}</span>
                  {'highlight' in item && item.highlight ? (
                    <Badge tone="brand" className="!px-1.5 !py-0 !text-[9px]">
                      AI
                    </Badge>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 rounded-2xl border border-brand-400/20 bg-gradient-to-br from-brand-500/15 to-aqua-400/5 p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-brand-200">
            <Sparkles className="size-3.5" />
            NOVA AI
          </div>
          <p className="text-[11px] leading-relaxed text-white/50">
            {t('home.askPlaceholder')}
          </p>
          <Link
            to="/assistant"
            className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg bg-white/10 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20"
          >
            {t('home.ctaAsk')}
          </Link>
        </div>

        {user ? (
          <div className="mt-4 border-t border-white/8 pt-3">
            <div className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500/70 to-aqua-400/50 text-xs font-bold text-white">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{user.name}</p>
                <p className="truncate text-[10px] text-white/35">{money(user.wallet.balanceCents)} · {user.wallet.points} {t('common.points')}</p>
              </div>
              <button
                onClick={() => {
                  signOut();
                  navigate('/');
                }}
                className="rounded-lg p-1.5 text-white/35 transition hover:bg-white/10 hover:text-rose-300"
                title={t('nav.signOut')}
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      {/* Top bar (mobile + desktop utility strip) */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-900/70 backdrop-blur-xl lg:pl-[264px]">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            className="rounded-xl border border-white/10 p-2 text-white/70 transition hover:bg-white/10 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
            {user ? (
              <>
                <Link
                  to="/wallet"
                  className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:border-brand-400/40 hover:bg-white/10 sm:flex"
                >
                  <Coins className="size-3.5 text-gold-300" />
                  <span className="font-mono font-semibold text-white">{money(user.wallet.balanceCents)}</span>
                  <span className="text-white/25">|</span>
                  <span className="text-gold-300">{user.wallet.points}</span>
                </Link>
                <Link
                  to="/assistant"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-aqua-400 px-3.5 py-2 text-xs font-semibold text-ink-950 transition hover:brightness-110"
                >
                  <Bot className="size-3.5" />
                  {t('home.ctaAsk')}
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/auth?mode=signin"
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-white/70 transition hover:text-white"
                >
                  {t('nav.signIn')}
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-aqua-400 px-3.5 py-2 text-xs font-semibold text-ink-950 transition hover:brightness-110"
                >
                  <BadgeDollarSign className="size-3.5" />
                  {t('nav.signUp')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
          <div className="glass-strong absolute inset-y-0 left-0 w-72 p-5 animate-rise">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                      isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {t(item.key)}
                </NavLink>
              ))}
            </nav>
            {user ? (
              <button
                onClick={() => {
                  signOut();
                  setMenuOpen(false);
                  navigate('/');
                }}
                className="mt-6 flex w-full items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/60 transition hover:border-rose-400/30 hover:text-rose-300"
              >
                <LogOut className="size-4" />
                {t('nav.signOut')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <main className="pb-24 lg:pb-10 lg:pl-[264px]">
        <div key={location.pathname} className="mx-auto w-full max-w-[1240px] px-4 pt-6 sm:px-6 lg:pt-8 animate-rise">{children}</div>
        <Footer />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-ink-900/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="flex items-stretch justify-between">
          {MOBILE_NAV.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition',
                  isActive ? 'text-brand-300' : 'text-white/40',
                )
              }
            >
              <item.icon className="size-5" />
              <span className="truncate">{t(item.key)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1240px] px-4 sm:px-6">
      <div className="border-t border-white/8 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/35">{t('footer.built')}</p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-white/40">
            <Link to="/shop" className="transition hover:text-white">{t('nav.shop')}</Link>
            <Link to="/assistant" className="transition hover:text-white">{t('nav.assistant')}</Link>
            <Link to="/help" className="transition hover:text-white">{t('nav.help')}</Link>
            <Link to="/wallet" className="transition hover:text-white">{t('nav.wallet')}</Link>
          </div>
        </div>
        <p className="mt-6 text-[11px] text-white/25">
          © {new Date().getFullYear()} NOVA · {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
