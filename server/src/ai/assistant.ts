import { q } from '../db/index.js';
import type { AuthUser } from '../middleware/auth.js';
import type { AssistantSuggestion, ChatMessage, OrderRow, Product, WalletRow } from '../types.js';
import { hasExternalLLM } from '../config.js';
import { semanticSearch, serializeProduct, categorySummary, activeProducts } from './catalog.js';
import { searchKnowledge } from './knowledge.js';
import { understand, type Intent, type Understanding } from './nlu.js';
import { recommendForUser } from './recommend.js';
import { buildForecast, densifyDaily } from './forecast.js';
import { streamCompletion } from './llm.js';
import { expandQuery, normalize } from './text.js';
import { uuid, nowIso } from '../lib/ids.js';

export interface AssistantRequest {
  user: AuthUser;
  message: string;
  locale: 'km' | 'en';
  history: ChatMessage[];
}

export interface AssistantAnswer {
  text: string;
  intent: Intent;
  confidence: number;
  products: ReturnType<typeof serializeProduct>[];
  citations: { id: string; titleEn: string; titleKm: string }[];
  suggestions: AssistantSuggestion[];
  engine: 'nova-builtin' | 'external-llm';
  latencyMs: number;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const tr = (locale: 'km' | 'en', km: string, en: string) => (locale === 'km' ? km : en);

interface UserSnapshot {
  wallet: WalletRow;
  orders: (OrderRow & { product_name_en: string; product_name_km: string })[];
  monthlySpendCents: number;
  previousMonthSpendCents: number;
}

function snapshot(userId: string): UserSnapshot {
  const wallet =
    q.get<WalletRow>('SELECT * FROM wallets WHERE user_id = ?', userId) ?? {
      user_id: userId,
      balance_cents: 0,
      currency: 'USD',
      points: 0,
      updated_at: new Date().toISOString(),
    };
  const orders = q.all<OrderRow & { product_name_en: string; product_name_km: string }>(
    `SELECT o.*, p.name_en AS product_name_en, p.name_km AS product_name_km
     FROM orders o JOIN products p ON p.id = o.product_id
     WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 20`,
    userId,
  );
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const prevStart = new Date(monthStart);
  prevStart.setMonth(prevStart.getMonth() - 1);

  const monthly = q.get<{ total: number }>(
    'SELECT COALESCE(SUM(amount_cents),0) AS total FROM orders WHERE user_id = ? AND created_at >= ?',
    userId,
    monthStart.toISOString(),
  );
  const previous = q.get<{ total: number }>(
    'SELECT COALESCE(SUM(amount_cents),0) AS total FROM orders WHERE user_id = ? AND created_at >= ? AND created_at < ?',
    userId,
    prevStart.toISOString(),
    monthStart.toISOString(),
  );

  return {
    wallet,
    orders,
    monthlySpendCents: monthly?.total ?? 0,
    previousMonthSpendCents: previous?.total ?? 0,
  };
}

function productLine(product: Product, locale: 'km' | 'en'): string {
  const name = locale === 'km' ? product.name_km : product.name_en;
  const extra: string[] = [];
  if (product.data_gb) extra.push(`${product.data_gb}GB`);
  if (product.validity_days) extra.push(tr(locale, `${product.validity_days} ថ្ងៃ`, `${product.validity_days}d`));
  return `• ${name} — ${money(product.price_cents)}${extra.length ? ` (${extra.join(' · ')})` : ''}`;
}

function suggestionForProduct(product: Product, locale: 'km' | 'en'): AssistantSuggestion {
  return {
    kind: 'product',
    id: product.id,
    labelKm: product.name_km,
    labelEn: product.name_en,
    payload: { priceCents: product.price_cents, provider: product.provider, route: `/shop?product=${product.id}` },
  };
}

function topupSuggestions(products: Product[], locale: 'km' | 'en'): AssistantSuggestion[] {
  return products.slice(0, 4).map((product) => suggestionForProduct(product, locale));
}

/** Compose a grounded, data-backed answer with the built-in engine. */
function composeBuiltin(
  request: AssistantRequest,
  understanding: Understanding,
  data: UserSnapshot,
): AssistantAnswer {
  const { locale, user } = request;
  const started = Date.now();
  const { intent, entities } = understanding;
  const queryText = `${request.message} ${entities.provider ?? ''} ${entities.dataGb ?? ''}GB`.trim();

  let text = '';
  let products: Product[] = [];
  let suggestions: AssistantSuggestion[] = [];
  let citations: AssistantAnswer['citations'] = [];

  const greetName = user.name.split(' ')[0];

  switch (intent) {
    case 'greeting': {
      const picks = recommendForUser(user.id, { limit: 3 });
      products = picks.map((pick) => pick.product);
      suggestions = topupSuggestions(products, locale);
      text = tr(
        locale,
        `សួស្តី ${greetName}! 👋 ខ្ញុំជា NOVA ជំនួយការ AI របស់អ្នក។ សមតុល្យកាបូបរបស់អ្នកគឺ ${money(data.wallet.balance_cents)} និងមាន ${data.wallet.points} ពិន្ទុ។\n\nនេះជាជម្រើសដែលសមស្របបំផុតសម្រាប់អ្នកថ្ងៃនេះ៖\n${products.map((product) => productLine(product, locale)).join('\n')}\n\nតើអ្នកចង់បញ្ចូលលុយទូរស័ព្ទ ទិញកញ្ចប់អ៊ីនធឺណិត ឬបង់វិក្កយបត្រទេ?`,
        `Hi ${greetName}! 👋 I'm NOVA, your AI shopping assistant. Your wallet holds ${money(data.wallet.balance_cents)} and you have ${data.wallet.points} points.\n\nHere are the best matches for you today:\n${products.map((product) => productLine(product, locale)).join('\n')}\n\nWould you like a phone top-up, a data bundle, or to pay a bill?`,
      );
      break;
    }

    case 'balance': {
      const lifetime = data.orders.reduce((sum, order) => sum + order.amount_cents, 0);
      text = tr(
        locale,
        `💰 **សមតុល្យកាបូប NOVA**\n• សមតុល្យបច្ចុប្បន្ន៖ ${money(data.wallet.balance_cents)}\n• ពិន្ទុរង្វាន់៖ ${data.wallet.points} (100 ពិន្ទុ = $1)\n• ចំណាយខែនេះ៖ ${money(data.monthlySpendCents)}\n• ការបញ្ជាទិញសរុប៖ ${data.orders.length}\n\nអ្នកអាចបញ្ចូលប្រាក់បានគ្រប់ពេលពីទំព័រកាបូប ហើយពិន្ទុអាចប្តូរជាឥណទានភ្លាមៗ។`,
        `💰 **NOVA wallet balance**\n• Available: ${money(data.wallet.balance_cents)}\n• Reward points: ${data.wallet.points} (100 points = $1)\n• Spent this month: ${money(data.monthlySpendCents)}\n• Lifetime order volume: ${money(lifetime)}\n\nYou can add funds any time from the Wallet page, and points convert to credit instantly.`,
      );
      suggestions = [
        { kind: 'action', labelKm: 'បញ្ចូលប្រាក់', labelEn: 'Add funds', payload: { route: '/wallet' } },
        { kind: 'action', labelKm: 'មើលប្រវត្តិ', labelEn: 'View history', payload: { route: '/orders' } },
      ];
      break;
    }

    case 'history': {
      if (!data.orders.length) {
        text = tr(
          locale,
          'អ្នកមិនទាន់មានការបញ្ជាទិញនៅឡើយទេ។ ចាប់ផ្តើមជាមួយកញ្ចប់ដែលពេញនិយមបំផុតបានហើយ!',
          "You don't have any orders yet. Start with one of the most popular bundles!",
        );
        products = recommendForUser(user.id, { limit: 3 }).map((pick) => pick.product);
        suggestions = topupSuggestions(products, locale);
        break;
      }
      const lines = data.orders
        .slice(0, 5)
        .map((order) => {
          const name = locale === 'km' ? order.product_name_km : order.product_name_en;
          const date = new Date(order.created_at).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-GB');
          return `• ${date} · ${name} → ${order.recipient} · ${money(order.amount_cents)} · ${order.status}`;
        })
        .join('\n');
      text = tr(
        locale,
        `🧾 **ការបញ្ជាទិញថ្មីៗ**\n${lines}\n\nចំណាយសរុបខែនេះ៖ ${money(data.monthlySpendCents)}។ ចុច "ប្រវត្តិ" ដើម្បីមើលលេខកូដដឹកជញ្ជូនទាំងអស់។`,
        `🧾 **Recent orders**\n${lines}\n\nSpent this month: ${money(data.monthlySpendCents)}. Open History to see every delivery code.`,
      );
      suggestions = [{ kind: 'action', labelKm: 'ប្រវត្តិទាំងអស់', labelEn: 'Full history', payload: { route: '/orders' } }];
      break;
    }

    case 'forecast': {
      const rows = q.all<{ date: string; value: number }>(
        `SELECT substr(created_at,1,10) AS date, COUNT(*) AS value
         FROM orders WHERE created_at >= datetime('now','-45 days') GROUP BY date`,
      );
      const forecast = buildForecast(densifyDaily(rows.reverse(), 42), 7);
      const nextWeek = forecast.forecast.reduce((sum, point) => sum + point.value, 0);
      text = tr(
        locale,
        `📈 **ការព្យាករណ៍តម្រូវការ (7 ថ្ងៃខាងមុខ)**\n• គំរូ៖ ${forecast.model}\n• ការបញ្ជាទិញរំពឹង៖ ${nextWeek}\n• និន្នាការ៖ ${forecast.trendPerDay > 0 ? 'កើនឡើង' : 'ថយចុះ'} ${Math.abs(forecast.trendPerDay).toFixed(2)}/ថ្ងៃ\n• ភាពត្រឹមត្រូវ (MAPE)៖ ${forecast.mape}% ធៀបនឹង baseline ${forecast.baselineMape}%\n\nដំបូន្មាន៖ រៀបចំស្តុកបន្ថែម 15-20% សម្រាប់ចុងសប្តាហ៍។`,
        `📈 **Demand forecast (next 7 days)**\n• Model: ${forecast.model}\n• Expected orders: ${nextWeek}\n• Trend: ${forecast.trendPerDay >= 0 ? 'up' : 'down'} ${Math.abs(forecast.trendPerDay).toFixed(2)}/day\n• Accuracy (MAPE): ${forecast.mape}% vs ${forecast.baselineMape}% seasonal-naive baseline\n\nRecommendation: hold 15-20% extra stock for the weekend spike.`,
      );
      citations = [{ id: 'kb-business', titleEn: 'For small businesses and agents', titleKm: 'សម្រាប់អាជីវកម្មតូច' }];
      suggestions = [{ kind: 'action', labelKm: 'ផ្ទាំងវិភាគ', labelEn: 'Open analytics', payload: { route: '/admin' } }];
      break;
    }

    case 'support': {
      const hits = searchKnowledge(request.message, locale, 2);
      citations = hits.map((hit) => ({
        id: hit.article.id,
        titleEn: hit.article.titleEn,
        titleKm: hit.article.titleKm,
      }));
      const lastOrder = data.orders[0];
      text = tr(
        locale,
        `🛟 ខ្ញុំជួយបាន។ ${hits[0]?.snippet ?? 'សូមប្រាប់បញ្ហារបស់អ្នកបន្ថែម។'}${
          lastOrder ? `\n\nការបញ្ជាទិញចុងក្រោយ៖ ${lastOrder.reference} (${lastOrder.status}) — ${money(lastOrder.amount_cents)}។` : ''
        }\n\nប្រសិនបើបញ្ហានៅតែបន្ត សូមផ្ញើលេខយោងមកខ្ញុំ ខ្ញុំនឹងបើកសំណើជំនួយជំនួសអ្នក។`,
        `🛟 Happy to help. ${hits[0]?.snippet ?? 'Tell me a little more about the issue.'}${
          lastOrder ? `\n\nYour latest order: ${lastOrder.reference} (${lastOrder.status}) — ${money(lastOrder.amount_cents)}.` : ''
        }\n\nIf it's still unresolved, send me the order reference and I'll open a support ticket for you.`,
      );
      suggestions = [
        { kind: 'action', labelKm: 'មជ្ឈមណ្ឌលជំនួយ', labelEn: 'Help centre', payload: { route: '/help' } },
        { kind: 'action', labelKm: 'បើកសំណើ', labelEn: 'Open a ticket', payload: { action: 'create_ticket' } },
      ];
      break;
    }

    case 'coverage':
    case 'order_help': {
      const hits = searchKnowledge(request.message, locale, 2);
      citations = hits.map((hit) => ({
        id: hit.article.id,
        titleEn: hit.article.titleEn,
        titleKm: hit.article.titleKm,
      }));
      text = hits.length
        ? tr(
            locale,
            `${hits[0].snippet}\n\n${hits[1] ? `${hits[1].snippet}` : ''}`.trim(),
            `${hits[0].snippet}\n\n${hits[1] ? `${hits[1].snippet}` : ''}`.trim(),
          )
        : tr(
            locale,
            'សូមសួរខ្ញុំអំពីការគ្របដណ្តប់បណ្តាញ ការបញ្ជាទិញ ឬការសងប្រាក់។',
            'Ask me about network coverage, ordering, or refunds.',
          );
      const picks = recommendForUser(user.id, { limit: 3, query: queryText });
      products = picks.map((pick) => pick.product);
      suggestions = topupSuggestions(products, locale);
      break;
    }

    case 'discover':
    case 'price':
    case 'recommend':
    case 'bill':
    case 'smalltalk':
    case 'unknown':
    default: {
      const recs = recommendForUser(user.id, {
        limit: 5,
        query: expandQuery(queryText),
        category: intent === 'bill' ? 'bills' : undefined,
      });
      const semantic = semanticSearch(queryText, 6);

      // Merge: learned recommender + lexical-semantic retrieval, deduped.
      const merged: Product[] = [];
      const seen = new Set<string>();
      for (const candidate of [...semantic.map((hit) => hit.product), ...recs.map((rec) => rec.product)]) {
        if (seen.has(candidate.id)) continue;
        if (entities.provider && candidate.provider !== entities.provider) continue;
        if (entities.dataGb && candidate.data_gb && candidate.data_gb < entities.dataGb) continue;
        seen.add(candidate.id);
        merged.push(candidate);
        if (merged.length >= 5) break;
      }
      if (!merged.length) merged.push(...activeProducts().sort((a, b) => b.popularity - a.popularity).slice(0, 4));

      products = merged;
      suggestions = topupSuggestions(products, locale);

      const reason = recs[0];
      const reasonText = reason
        ? tr(locale, reason.reasonsKm[0] ?? '', reason.reasonsEn[0] ?? '')
        : '';

      if (intent === 'bill') {
        text = tr(
          locale,
          `🧾 ខ្ញុំរកឃើញសេវាបង់វិក្កយបត្រទាំងនេះ៖\n${products
            .map((product) => productLine(product, locale))
            .join('\n')}\n\nអ្នកអាចបង់វិក្កយបត្រភ្លើង ទឹក និងអ៊ីនធឺណិតផ្ទះបានភ្លាមៗដោយប្រើកាបូប NOVA។`,
          `🧾 Here are the bill-payment services I found:\n${products
            .map((product) => productLine(product, locale))
            .join('\n')}\n\nYou can settle electricity, water and home internet instantly with your NOVA wallet.`,
        );
      } else if (intent === 'smalltalk') {
        text = tr(
          locale,
          'រីករាយណាស់! 😊 ប្រសិនបើត្រូវការបញ្ចូលលុយ ឬបង់វិក្កយបត្រ ខ្ញុំនៅទីនេះជានិច្ច។',
          "Anytime! 😊 If you need a top-up or a bill paid, I'm right here.",
        );
      } else if (intent === 'unknown' && semantic.length === 0) {
        const cats = categorySummary().slice(0, 4);
        text = tr(
          locale,
          `ខ្ញុំមិនទាន់យល់ច្បាស់ទេ 🙏 ប៉ុន្តែខ្ញុំអាចជួយអ្នកបានជាមួយ៖\n${cats
            .map((cat) => `• ${cat.category} (${cat.count} ផលិតផល)`)
            .join('\n')}\n\nសូមប្រាប់ខ្ញុំពីបណ្តាញ និងថវិការបស់អ្នក ឧទាហរណ៍ "Smart 1 ដុល្លារ"។`,
          `I didn't quite catch that 🙏 Here's what I can help with:\n${cats
            .map((cat) => `• ${cat.category} (${cat.count} products)`)
            .join('\n')}\n\nTell me your carrier and budget, e.g. "Smart $1 data".`,
        );
      } else {
        text = tr(
          locale,
          `ខ្ញុំបានវិភាគសំណើរបស់អ្នក ហើយនេះជាជម្រើសដែលសមស្របបំផុត៖\n${products
            .map((product) => productLine(product, locale))
            .join('\n')}\n\n${
            reasonText ? `💡 ហេតុអ្វីជ្រើសរើស៖ ${reasonText}។` : ''
          }\nសមតុល្យកាបូបរបស់អ្នក ${money(data.wallet.balance_cents)} គឺគ្រប់គ្រាន់សម្រាប់ជម្រើសទីមួយ។`,
          `I analysed your request — these are the closest matches:\n${products
            .map((product) => productLine(product, locale))
            .join('\n')}\n\n${reasonText ? `💡 Why these: ${reasonText}.` : ''}\nYour balance of ${money(
            data.wallet.balance_cents,
          )} covers the first option.`,
        );
      }
      break;
    }
  }

  return {
    text,
    intent,
    confidence: Number(understanding.confidence.toFixed(2)),
    products: products.map(serializeProduct),
    citations,
    suggestions,
    engine: 'nova-builtin',
    latencyMs: Date.now() - started,
  };
}

/** Retrieval-augmented context handed to the optional external LLM. */
function buildRagPrompt(request: AssistantRequest, understanding: Understanding, data: UserSnapshot): ChatMessage[] {
  const hits = searchKnowledge(request.message, request.locale, 3);
  const recs = recommendForUser(request.user.id, { limit: 5, query: request.message });
  const catalog = recs
    .map(
      (rec) =>
        `- ${rec.product.name_en} / ${rec.product.name_km} | ${rec.product.provider} | ${rec.product.category} | $${(
          rec.product.price_cents / 100
        ).toFixed(2)} | ${rec.product.data_gb ?? '-'}GB | ${rec.product.validity_days ?? '-'}d`,
    )
    .join('\n');

  const system = [
    'You are NOVA, the AI concierge of a Cambodian top-up and digital services super app.',
    'Answer in the user language: Khmer if their message is Khmer, otherwise English.',
    'Be concise (max 160 words), concrete, and never invent products or prices.',
    'Only recommend products from the CANDIDATES list, quoting their exact prices.',
    'Use markdown bullets. If you cite a help article, end with "Source: <title>".',
    '',
    'CANDIDATES:',
    catalog || '(none)',
    '',
    'HELP CENTRE EXCERPTS:',
    hits.map((hit) => `[${hit.article.titleEn}] ${hit.snippet}`).join('\n') || '(none)',
    '',
    `CUSTOMER: ${request.user.name} | wallet $${(data.wallet.balance_cents / 100).toFixed(2)} | ${
      data.wallet.points
    } points | spend this month $${(data.monthlySpendCents / 100).toFixed(2)}`,
    `DETECTED INTENT: ${understanding.intent} (confidence ${understanding.confidence.toFixed(2)})`,
  ].join('\n');

  const history: ChatMessage[] = request.history
    .filter((message) => message.role !== 'system')
    .slice(-8)
    .map((message) => ({ role: message.role, content: message.content }));

  return [{ role: 'system', content: system }, ...history, { role: 'user', content: request.message }];
}

export function prepareAnswer(
  request: AssistantRequest,
): { understanding: Understanding; builtin: AssistantAnswer; rag: ChatMessage[] | null } {
  const understanding = understand(request.message);
  const data = snapshot(request.user.id);
  const builtin = composeBuiltin(request, understanding, data);
  const rag = hasExternalLLM() ? buildRagPrompt(request, understanding, data) : null;
  return { understanding, builtin, rag };
}

export type StreamEvent =
  | { type: 'meta'; payload: Omit<AssistantAnswer, 'text'> }
  | { type: 'token'; payload: { text: string } }
  | { type: 'done'; payload: { text: string; engine: AssistantAnswer['engine'] } };

/**
 * Stream an answer. Uses the external LLM when configured and healthy,
 * otherwise falls back to the grounded built-in engine's text.
 */
export async function* streamAnswer(request: AssistantRequest): AsyncGenerator<StreamEvent> {
  const started = Date.now();
  const { builtin, rag } = prepareAnswer(request);
  const { text: _seed, ...meta } = builtin;
  yield { type: 'meta', payload: { ...meta, engine: rag ? 'external-llm' : 'nova-builtin' } };

  let full = '';
  let usedLlm = false;

  if (rag) {
    for await (const token of streamCompletion(rag)) {
      usedLlm = true;
      full += token;
      yield { type: 'token', payload: { text: token } };
    }
  }

  if (!usedLlm) {
    // Built-in engine "streams" in small word groups so the UI types naturally.
    const chunks = builtin.text.match(/[\s\S]{3,14}?(?=\s|$)|\s+|[\s\S]+/g) ?? [builtin.text];
    for (const chunk of chunks) {
      full += chunk;
      yield { type: 'token', payload: { text: chunk } };
      await new Promise((resolve) => setTimeout(resolve, 14));
    }
  }

  yield {
    type: 'done',
    payload: { text: full, engine: usedLlm ? 'external-llm' : 'nova-builtin' },
  };
  logAssistant(request, full, Date.now() - started);
}

function logAssistant(request: AssistantRequest, answer: string, latencyMs: number) {
  try {
    q.run(
      'INSERT INTO events (id, user_id, name, payload, created_at) VALUES (?, ?, ?, ?, ?)',
      uuid(),
      request.user.id,
      'assistant_answer',
      JSON.stringify({ chars: answer.length, latencyMs, locale: request.locale }),
      nowIso(),
    );
  } catch {
    // analytics must never break a conversation
  }
}

export function normalizeLocale(value: string | undefined): 'km' | 'en' {
  return normalize(value ?? '') === 'en' ? 'en' : 'km';
}
