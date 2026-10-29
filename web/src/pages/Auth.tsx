import { clsx } from 'clsx';
import { ArrowRight, KeyRound, Mail, ShieldCheck, Sparkles, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, Input } from '../components/ui';
import { Logo } from '../components/Layout';

export function AuthPage() {
  const { t, lang } = useI18n();
  const { user, signIn, signUp } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [mode, setMode] = useState<'signin' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = params.get('next') ?? '/';

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, navigate, next]);

  useEffect(() => {
    setError(null);
  }, [mode]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        const signedIn = await signIn(email.trim(), password);
        toast.success(`សូមស្វាគមន៍ ${signedIn.name}`, `NOVA · ${lang === 'km' ? 'ចូលបានជោគជ័យ' : 'signed in'}`);
      } else {
        const created = await signUp({ name: name.trim(), email: email.trim(), password, locale: lang });
        toast.success(`${created.name}!`, lang === 'km' ? 'ទទួលបានឥណទានស្វាគមន៍ $50' : 'Welcome credit of $50 added');
      }
      navigate(next, { replace: true });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Authentication failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const useDemo = async (role: 'customer' | 'admin') => {
    setMode('signin');
    const demoEmail = role === 'admin' ? 'admin@nova.ai' : 'demo@nova.ai';
    const demoPassword = role === 'admin' ? 'Admin@123' : 'Demo@1234';
    setEmail(demoEmail);
    setPassword(demoPassword);
    setBusy(true);
    try {
      await signIn(demoEmail, demoPassword);
      navigate(role === 'admin' ? '/admin' : next, { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Demo login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-6 py-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
      <Card className="ring-gradient p-6 sm:p-8">
        <Logo />
        <h1 className="font-display mt-6 text-2xl font-semibold text-white">
          {mode === 'signin' ? t('auth.signInTitle') : t('auth.signUpTitle')}
        </h1>
        <p className="mt-1 text-sm text-white/45">{mode === 'signin' ? t('auth.signInSub') : t('auth.signUpSub')}</p>

        <form onSubmit={submit} className="mt-6 space-y-3.5">
          {mode === 'signup' ? (
            <div className="relative">
              <Input
                label={t('auth.name')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sokha Chan"
                required
                minLength={2}
                className="pl-10"
              />
              <UserIcon className="pointer-events-none absolute bottom-3.5 left-3.5 size-4 text-white/25" />
            </div>
          ) : null}

          <div className="relative">
            <Input
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="pl-10"
            />
            <Mail className="pointer-events-none absolute bottom-3.5 left-3.5 size-4 text-white/25" />
          </div>

          <div className="relative">
            <Input
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="pl-10"
            />
            <KeyRound className="pointer-events-none absolute bottom-3.5 left-3.5 size-4 text-white/25" />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>
          ) : null}

          <Button type="submit" size="lg" className="w-full" loading={busy} icon={<ArrowRight className="size-4" />}>
            {mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-white/40">
          {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="font-semibold text-brand-300 transition hover:text-white"
          >
            {mode === 'signin' ? t('auth.signUp') : t('auth.signIn')}
          </button>
        </p>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold-300" />
            <p className="text-sm font-semibold text-white">{t('auth.demoTitle')}</p>
          </div>
          <p className="mt-1 text-[11px] text-white/40">
            {lang === 'km'
              ? 'សាកល្បងគ្រប់មុខងារដោយមិនចាំបាច់ចុះឈ្មោះ។'
              : 'Explore every feature without registering.'}
          </p>

          <div className="mt-3 space-y-2">
            {[
              { role: 'customer' as const, label: t('auth.demoCustomer'), email: 'demo@nova.ai', password: 'Demo@1234' },
              { role: 'admin' as const, label: t('auth.demoAdmin'), email: 'admin@nova.ai', password: 'Admin@123' },
            ].map((account) => (
              <button
                key={account.role}
                onClick={() => void useDemo(account.role)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-brand-400/40 hover:bg-white/[0.07]"
              >
                <div>
                  <p className="text-[11px] font-semibold text-white">{account.label}</p>
                  <p className="font-mono text-[10px] text-white/35">
                    {account.email} · {account.password}
                  </p>
                </div>
                <span className="rounded-lg bg-white/8 px-2 py-1 text-[10px] text-white/60">{t('auth.useDemo')}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <Badge tone="mint">
            <ShieldCheck className="size-3" /> {lang === 'km' ? 'សុវត្ថិភាព' : 'Security'}
          </Badge>
          <ul className="khmer space-y-2 text-[11px] text-white/45">
            <li className="flex gap-2">
              <span className="text-brand-300">•</span>
              {lang === 'km'
                ? 'ពាក្យសម្ងាត់ត្រូវបានរក្សាទុកដោយ scrypt (memory-hard)'
                : 'Passwords are hashed with scrypt (memory-hard)'}
            </li>
            <li className="flex gap-2">
              <span className="text-brand-300">•</span>
              {lang === 'km' ? 'សម័យ JWT មានរយៈពេល 12 ម៉ោង' : 'JWT sessions expire after 12 hours'}
            </li>
            <li className="flex gap-2">
              <span className="text-brand-300">•</span>
              {lang === 'km'
                ? 'ការវាយតម្លៃហានិភ័យរាល់ប្រតិបត្តិការ'
                : 'Every transaction is risk-scored'}
            </li>
          </ul>
          <div className={clsx('rounded-xl border border-white/8 bg-white/[0.03] p-3 text-[11px] text-white/45')}>
            {t('auth.welcomeCredit')}
          </div>
        </Card>

        <p className="text-center text-xs text-white/30">
          <Link to="/shop" className="hover:text-white">
            {t('home.ctaShop')}
          </Link>{' '}
          ·{' '}
          <Link to="/help" className="hover:text-white">
            {t('nav.help')}
          </Link>
        </p>
      </div>
    </div>
  );
}
