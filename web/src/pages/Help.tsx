import { BookOpen, ChevronDown, LifeBuoy, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsync, useDebounced } from '../lib/hooks';
import { useI18n } from '../lib/i18n';
import { Badge, Button, Card, Skeleton } from '../components/ui';

interface Article {
  id: string;
  titleEn: string;
  titleKm: string;
  bodyEn: string;
  bodyKm: string;
  tags: string[];
}

export function HelpPage() {
  const { t, lang, pickText } = useI18n();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 300);
  const [open, setOpen] = useState<string | null>(null);

  const articles = useAsync(
    () => api.get<{ items: Article[] }>(`/help/articles${debounced ? `?q=${encodeURIComponent(debounced)}&locale=${lang}` : ''}`),
    [debounced, lang],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-aqua-400/15">
          <LifeBuoy className="size-6 text-brand-200" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-white">{t('help.title')}</h1>
        <p className="khmer mt-1.5 text-sm text-white/45">{t('help.subtitle')}</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={pickText('ស្វែងរកចម្លើយ...', 'Search answers...')}
          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white placeholder:text-white/30 transition focus:border-brand-400/50 focus:outline-none"
          aria-label="Search"
        />
      </div>

      {articles.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {articles.data?.items.map((article) => {
            const expanded = open === article.id;
            return (
              <Card key={article.id} className="overflow-hidden" hover>
                <button
                  onClick={() => setOpen(expanded ? null : article.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  aria-expanded={expanded}
                >
                  <BookOpen className="size-4 shrink-0 text-brand-300" />
                  <span className="khmer flex-1 text-sm font-medium text-white">
                    {lang === 'km' ? article.titleKm : article.titleEn}
                  </span>
                  <ChevronDown className={`size-4 shrink-0 text-white/30 transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded ? (
                  <div className="border-t border-white/6 px-4 py-3.5">
                    <p className="khmer text-xs leading-relaxed text-white/55">
                      {lang === 'km' ? article.bodyKm : article.bodyEn}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {article.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} tone="neutral">#{tag}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
          {!articles.data?.items.length ? (
            <p className="py-10 text-center text-sm text-white/35">
              {pickText('រកមិនឃើញអត្ថបទ', 'No articles found')}
            </p>
          ) : null}
        </div>
      )}

      <Card className="flex flex-col items-start gap-3 border-brand-400/20 bg-gradient-to-br from-brand-500/15 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-200" />
          <div>
            <p className="text-sm font-semibold text-white">{pickText('មិនឃើញចម្លើយ?', 'Still stuck?')}</p>
            <p className="khmer mt-0.5 text-xs text-white/45">
              {pickText('សួរ NOVA ផ្ទាល់ — វាឆ្លើយដោយប្រើប្រវត្តិគណនីរបស់អ្នក។', 'Ask NOVA directly — it answers using your own account history.')}
            </p>
          </div>
        </div>
        <Link to="/assistant">
          <Button size="sm">{t('help.ask')}</Button>
        </Link>
      </Card>
    </div>
  );
}
