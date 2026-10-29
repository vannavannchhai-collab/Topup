import { clsx } from 'clsx';
import {
  ArrowUp,
  Bot,
  BookOpen,
  BrainCircuit,
  MessageSquarePlus,
  MessagesSquare,
  Plus,
  Sparkles,
  Square,
  Trash2,
  User as UserIcon,
  Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, streamChat } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, relativeTime, renderMarkdown } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';
import type { Product, Suggestion } from '../lib/types';
import { CheckoutModal } from '../components/Checkout';
import { Badge, Button, EmptyState } from '../components/ui';

interface Citation {
  id: string;
  titleEn: string;
  titleKm: string;
}

interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  intent?: string;
  confidence?: number;
  engine?: string;
  latencyMs?: number;
  products?: Product[];
  citations?: Citation[];
  suggestions?: Suggestion[];
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

const INTENT_TONE: Record<string, 'brand' | 'aqua' | 'gold' | 'mint' | 'rose' | 'neutral'> = {
  greeting: 'brand',
  discover: 'aqua',
  recommend: 'brand',
  balance: 'gold',
  history: 'neutral',
  order_help: 'neutral',
  coverage: 'aqua',
  price: 'gold',
  bill: 'gold',
  forecast: 'brand',
  support: 'rose',
  smalltalk: 'neutral',
  unknown: 'neutral',
};

export function AssistantPage() {
  const { t, lang, pick, pickText } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef(false);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const result = await api.get<{ conversations: ConversationSummary[] }>('/assistant/conversations');
      setConversations(result.conversations);
    } catch {
      /* non-critical */
    }
  }, [user]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (id: string) => {
    try {
      const result = await api.get<{
        conversation: { id: string; title: string };
        messages: { id: string; role: 'user' | 'assistant'; content: string; meta: any; createdAt: string }[];
      }>(`/assistant/conversations/${id}`);
      setConversationId(result.conversation.id);
      setMessages(
        result.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          intent: message.meta?.intent,
          products: undefined,
        })),
      );
    } catch {
      toast.error(t('common.error'));
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setInput('');
  };

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || busy || !user) return;

      setInput('');
      setBusy(true);
      const userMessage: ChatMessageView = { id: `u-${Date.now()}`, role: 'user', content: message };
      const assistantId = `a-${Date.now()}`;
      const placeholder: ChatMessageView = {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        engine: 'nova-builtin',
      };

      const history = [...messages, userMessage].slice(-8).map((entry) => ({ role: entry.role, content: entry.content }));
      setMessages((current) => [...current, userMessage, placeholder]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat(
          { message, locale: lang, conversationId, history },
          {
            onConversation: (id) => setConversationId(id),
            onMeta: (meta) => {
              setMessages((current) =>
                current.map((entry) =>
                  entry.id === assistantId
                    ? {
                        ...entry,
                        intent: meta.intent,
                        confidence: meta.confidence,
                        engine: meta.engine,
                        latencyMs: meta.latencyMs,
                        products: meta.products,
                        citations: meta.citations,
                        suggestions: meta.suggestions,
                      }
                    : entry,
                ),
              );
            },
            onToken: (text) => {
              setMessages((current) =>
                current.map((entry) =>
                  entry.id === assistantId ? { ...entry, content: entry.content + text } : entry,
                ),
              );
            },
            onDone: () => {
              setMessages((current) =>
                current.map((entry) =>
                  entry.id === assistantId ? { ...entry, streaming: false } : entry,
                ),
              );
            },
            onError: (errorMessage) => {
              toast.error(t('common.error'), errorMessage);
              setMessages((current) =>
                current.map((entry) =>
                  entry.id === assistantId ? { ...entry, streaming: false, content: entry.content || errorMessage } : entry,
                ),
              );
            },
          },
          controller.signal,
        );
      } catch (error) {
        if ((error as Error).name !== 'AbortError') toast.error(t('common.error'));
      } finally {
        setBusy(false);
        abortRef.current = null;
        void loadConversations();
      }
    },
    [busy, conversationId, lang, loadConversations, messages, t, toast, user],
  );

  // Deep link from the home hero: /assistant?q=...
  useEffect(() => {
    const q = params.get('q');
    if (!q || !user || autoSentRef.current) return;
    autoSentRef.current = true;
    setParams({}, { replace: true });
    void send(q);
  }, [params, send, setParams, user]);

  const handleSuggestion = (suggestion: Suggestion) => {
    if (suggestion.kind === 'product' && suggestion.id) {
      const product = messages
        .flatMap((message) => message.products ?? [])
        .find((entry) => entry.id === suggestion.id);
      if (product) {
        setCheckoutProduct(product);
        return;
      }
    }
    const route = suggestion.payload?.route;
    if (typeof route === 'string') navigate(route);
    else void send(suggestion.labelEn);
  };

  const prompts = useMemo(
    () => [t('assistant.prompt1'), t('assistant.prompt2'), t('assistant.prompt3'), t('assistant.prompt4')],
    [t],
  );

  if (!user) {
    return (
      <div className="py-16">
        <EmptyState
          icon={<Bot className="size-6" />}
          title={t('assistant.signInPrompt')}
          body={t('assistant.emptyBody')}
          action={
            <Link to="/auth?mode=signin">
              <Button>{t('nav.signIn')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      {/* Conversation rail */}
      <aside className="hidden lg:block">
        <Button
          onClick={startNewChat}
          variant="secondary"
          className="w-full"
          icon={<MessageSquarePlus className="size-4" />}
        >
          {t('assistant.newChat')}
        </Button>

        <p className="mt-6 mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
          {t('assistant.history')}
        </p>
        <div className="space-y-1">
          {conversations.length === 0 ? (
            <p className="px-2 text-[11px] text-white/25">{pickText('មិនទាន់មាន', 'Nothing yet')}</p>
          ) : (
            conversations.map((conversation) => (
              <div key={conversation.id} className="group flex items-center gap-1">
                <button
                  onClick={() => openConversation(conversation.id)}
                  className={clsx(
                    'flex min-w-0 flex-1 flex-col rounded-xl px-2.5 py-2 text-left transition',
                    conversationId === conversation.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/45 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <span className="truncate text-[11px] font-medium">{conversation.title}</span>
                  <span className="text-[10px] text-white/25">{relativeTime(conversation.updatedAt, lang)}</span>
                </button>
                <button
                  onClick={async () => {
                    await api.delete(`/assistant/conversations/${conversation.id}`).catch(() => undefined);
                    if (conversationId === conversation.id) startNewChat();
                    void loadConversations();
                  }}
                  className="rounded-lg p-1 text-white/0 transition group-hover:text-white/30 hover:!text-rose-400"
                  aria-label="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat panel */}
      <div className="glass flex min-h-[calc(100dvh-210px)] flex-col overflow-hidden rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-aqua-400">
              <Bot className="size-4.5 text-ink-950" />
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-ink-900 bg-mint-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{t('assistant.title')}</p>
              <p className="text-[10px] text-white/35">{t('assistant.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand" className="hidden sm:inline-flex">
              <BrainCircuit className="size-3" /> {pickText('ពីរភាសា', 'bilingual')}
            </Badge>
            <button
              onClick={startNewChat}
              className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
              title={t('assistant.newChat')}
            >
              <Plus className="size-4" />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-3 py-5 sm:px-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <div className="relative mb-5">
                <div className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500/25 to-aqua-400/15">
                  <Sparkles className="size-7 text-brand-200" />
                </div>
                <span className="absolute inset-0 animate-pulse-ring rounded-3xl bg-brand-400/25" />
              </div>
              <h2 className="font-display text-xl font-semibold text-white">{t('assistant.emptyTitle')}</h2>
              <p className="khmer mt-2 max-w-md text-xs leading-relaxed text-white/45">{t('assistant.emptyBody')}</p>
              <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void send(prompt)}
                    className="khmer group flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-left text-[11px] text-white/60 transition hover:border-brand-400/40 hover:bg-white/[0.07] hover:text-white"
                  >
                    <Wand2 className="size-3.5 shrink-0 text-brand-300" />
                    <span className="line-clamp-2">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={clsx('flex gap-2.5', message.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div
                  className={clsx(
                    'flex size-8 shrink-0 items-center justify-center rounded-xl',
                    message.role === 'user'
                      ? 'bg-white/10 text-white/60'
                      : 'bg-gradient-to-br from-brand-500 to-aqua-400 text-ink-950',
                  )}
                >
                  {message.role === 'user' ? <UserIcon className="size-4" /> : <Bot className="size-4" />}
                </div>

                <div className={clsx('min-w-0 max-w-[88%] space-y-2.5', message.role === 'user' && 'items-end')}>
                  <div
                    className={clsx(
                      'rounded-2xl px-4 py-3 text-[13px]',
                      message.role === 'user'
                        ? 'rounded-br-sm bg-brand-500/20 text-white'
                        : 'rounded-bl-sm border border-white/8 bg-white/[0.04] text-white/80',
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <>
                        {message.content ? (
                          <div
                            className="khmer markdown space-y-0.5"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 py-0.5">
                            {[0, 1, 2].map((index) => (
                              <span
                                key={index}
                                className="size-1.5 animate-bounce rounded-full bg-brand-300"
                                style={{ animationDelay: `${index * 120}ms` }}
                              />
                            ))}
                            <span className="ml-1 text-[11px] text-white/35">{t('assistant.thinking')}</span>
                          </div>
                        )}
                        {message.streaming && message.content ? (
                          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-aqua-300 align-middle" />
                        ) : null}
                      </>
                    ) : (
                      <span className="khmer">{message.content}</span>
                    )}
                  </div>

                  {message.role === 'assistant' && message.products && message.products.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {message.products.slice(0, 4).map((product) => (
                        <button
                          key={product.id}
                          onClick={() => setCheckoutProduct(product)}
                          className="group flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition hover:border-brand-400/40 hover:bg-white/[0.07]"
                        >
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/30 to-aqua-400/15 text-[10px] font-bold uppercase text-white">
                            {product.provider.slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium text-white">{pick(product)}</p>
                            <p className="text-[10px] text-white/35">
                              {money(product.priceCents)}
                              {product.dataGb ? ` · ${product.dataGb}GB` : ''}
                            </p>
                          </div>
                          <ArrowUp className="size-3.5 rotate-45 text-white/25 transition group-hover:text-brand-300" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {message.role === 'assistant' && message.citations && message.citations.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/25">
                        <BookOpen className="size-3" /> {t('assistant.sources')}
                      </span>
                      {message.citations.map((citation) => (
                        <Link
                          key={citation.id}
                          to={`/help#${citation.id}`}
                          className="rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] text-white/50 transition hover:bg-white/12 hover:text-white"
                        >
                          {lang === 'km' ? citation.titleKm : citation.titleEn}
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && !message.streaming ? (
                    <div className="flex flex-wrap gap-1.5">
                      {message.suggestions.slice(0, 3).map((suggestion, index) => (
                        <button
                          key={`${suggestion.labelEn}-${index}`}
                          onClick={() => handleSuggestion(suggestion)}
                          className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/55 transition hover:border-brand-400/40 hover:bg-white/8 hover:text-white"
                        >
                          {lang === 'km' ? suggestion.labelKm : suggestion.labelEn}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {message.role === 'assistant' && message.intent && !message.streaming ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-white/25">
                      <Badge tone={INTENT_TONE[message.intent] ?? 'neutral'} className="!text-[9px]">
                        {message.intent}
                      </Badge>
                      {message.confidence ? <span>{Math.round(message.confidence * 100)}% {t('assistant.confidence')}</span> : null}
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <BrainCircuit className="size-2.5" />
                        {message.engine === 'external-llm' ? pickText('LLM ខាងក្រៅ', 'external LLM') : 'nova-retrieval-v1'}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/8 p-3 sm:p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-white/10 bg-ink-850/70 p-1.5 pl-3 transition focus-within:border-brand-400/50"
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder={t('assistant.placeholder')}
              className="khmer max-h-32 flex-1 resize-none bg-transparent py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
            {busy ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<Square className="size-3" />}
                onClick={() => abortRef.current?.abort()}
              >
                {t('common.cancel')}
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={!input.trim()} icon={<ArrowUp className="size-3.5" />}>
                {t('assistant.send')}
              </Button>
            )}
          </form>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-white/25">
            <MessagesSquare className="size-3" />
            {pickText(
              'NOVA ឆ្លើយដោយផ្អែកលើផលិតផល និងទិន្នន័យគណនីពិតរបស់អ្នក',
              'Answers are grounded in real catalog and account data',
            )}
          </p>
        </div>
      </div>

      <CheckoutModal product={checkoutProduct} open={Boolean(checkoutProduct)} onClose={() => setCheckoutProduct(null)} />
    </div>
  );
}
