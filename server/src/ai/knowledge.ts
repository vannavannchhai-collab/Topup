import { TfidfIndex, tokenize } from './text.js';

export interface KnowledgeArticle {
  id: string;
  titleEn: string;
  titleKm: string;
  bodyEn: string;
  bodyKm: string;
  tags: string[];
}

export const KNOWLEDGE_BASE: KnowledgeArticle[] = [
  {
    id: 'kb-order-flow',
    titleEn: 'How to place a top-up order',
    titleKm: 'របៀបបញ្ជាទិញបញ្ចូលលុយ',
    bodyEn:
      'Pick a product, enter the recipient number, confirm the price, then tap Pay with wallet. The voucher or data bundle is delivered in seconds; the delivery code appears on your order receipt and in Order history.',
    bodyKm:
      'ជ្រើសរើសផលិតផល បញ្ចូលលេខទូរស័ព្ទអ្នកទទួល បញ្ជាក់តម្លៃ រួចចុចបង់ប្រាក់ដោយកាបូប។ ប័ណ្ណ ឬកញ្ចប់អ៊ីនធឺណិតត្រូវបានផ្ញើក្នុងរយៈពេលប៉ុន្មានវិនាទី ហើយលេខកូដនឹងបង្ហាញនៅក្នុងបង្កាន់ដៃ និងប្រវត្តិការបញ្ជាទិញ។',
    tags: ['order', 'how to', 'pay', 'delivery', 'បញ្ជាទិញ'],
  },
  {
    id: 'kb-refund',
    titleEn: 'Refunds and failed top-ups',
    titleKm: 'ការសងប្រាក់ និងការបញ្ចូលលុយបរាជ័យ',
    bodyEn:
      'If a top-up fails, your wallet is refunded automatically within minutes. For a wrong number, contact support within 30 minutes with your order reference — we will attempt a carrier reversal. Refunds are returned to NOVA wallet credit, not to a card.',
    bodyKm:
      'ប្រសិនបើការបញ្ចូលលុយបរាជ័យ កាបូបរបស់អ្នកនឹងទទួលប្រាក់វិញដោយស្វ័យប្រវត្តិក្នុងរយៈពេលប៉ុន្មាននាទី។ ប្រសិនបើលេខខុស សូមទាក់ទងផ្នែកជំនួយក្នុងរយៈពេល 30 នាទី ជាមួយលេខយោងនៃការបញ្ជាទិញ — យើងនឹងព្យាយាមត្រឡប់តាមបណ្តាញ។ ប្រាក់សងត្រូវត្រឡប់ទៅកាបូប NOVA មិនមែនទៅកាតទេ។',
    tags: ['refund', 'failed', 'support', 'សងប្រាក់', 'បរាជ័យ'],
  },
  {
    id: 'kb-coverage',
    titleEn: 'Network coverage and speeds',
    titleKm: 'ការគ្របដណ្តប់បណ្តាញ និងល្បឿន',
    bodyEn:
      'Smart and Cellcard offer 5G in Phnom Penh, Siem Reap and Sihanoukville, with 4G+ across most provincial towns. Metfone has the widest rural 4G footprint. Data bundles are throttle-free until the high-speed allowance is used.',
    bodyKm:
      'Smart និង Cellcard ផ្តល់ 5G នៅភ្នំពេញ សៀមរាប និងព្រះសីហនុ ជាមួយ 4G+ នៅទីរួមខេត្តភាគច្រើន។ Metfone មានបណ្តាញ 4G ជនបទធំទូលាយបំផុត។ កញ្ចប់អ៊ីនធឺណិតមិនត្រូវបានបន្ថយល្បឿនទេ រហូតដល់ប្រើអស់កូតាល្បឿនលឿន។',
    tags: ['coverage', 'network', '5g', 'signal', 'សញ្ញា'],
  },
  {
    id: 'kb-wallet',
    titleEn: 'Wallet, points and rewards',
    titleKm: 'កាបូប ពិន្ទុ និងរង្វាន់',
    bodyEn:
      'Every completed order earns 1 NOVA point per 100 riel spent (about 0.4 points per dollar). Points redeem at 100 points = $1 wallet credit. Wallet balances never expire and are protected by risk monitoring on every transaction.',
    bodyKm:
      'ការបញ្ជាទិញដែលបានបញ្ចប់នីមួយៗទទួលបាន 1 ពិន្ទុ NOVA ក្នុង 100 រៀល (ប្រហែល 0.4 ពិន្ទុក្នុងមួយដុល្លារ)។ ពិន្ទុអាចប្តូរបាន 100 ពិន្ទុ = 1 ដុល្លារឥណទានកាបូប។ សមតុល្យកាបូបមិនផុតកំណត់ ហើយត្រូវបានការពារដោយការត្រួតពិនិត្យហានិភ័យ។',
    tags: ['wallet', 'points', 'rewards', 'កាបូប', 'ពិន្ទុ'],
  },
  {
    id: 'kb-autotopup',
    titleEn: 'Auto top-up for your own number',
    titleKm: 'ការបញ្ចូលលុយស្វ័យប្រវត្តិ',
    bodyEn:
      'Enable auto top-up in the assistant: tell NOVA "auto top up my smart number 010 123 456 when it drops below $2". NOVA then schedules a recurring order each time your balance threshold is hit, capped at your monthly budget.',
    bodyKm:
      'បើកការបញ្ចូលលុយស្វ័យប្រវត្តិក្នុងជំនួយការ៖ ប្រាប់ NOVA ថា "បញ្ចូលលុយលេខ smart 010 123 456 ដោយស្វ័យប្រវត្តិ ពេលនៅសល់តិចជាង 2 ដុល្លារ"។ NOVA នឹងកំណត់ការបញ្ជាទិញម្តងទៀត រាល់ពេលឈានដល់កម្រិតកំណត់ ដោយមានដែនកំណត់ថវិកាប្រចាំខែ។',
    tags: ['auto topup', 'recurring', 'schedule', 'ស្វ័យប្រវត្តិ'],
  },
  {
    id: 'kb-security',
    titleEn: 'Keeping your account secure',
    titleKm: 'ការការពារគណនីរបស់អ្នក',
    bodyEn:
      'NOVA scores every order for fraud risk. Use a strong unique password, never share delivery codes, and be careful of anyone asking you to buy top-ups for them — that pattern is the most common scam in the region.',
    bodyKm:
      'NOVA វាយតម្លៃហានិភ័យរាល់ការបញ្ជាទិញ។ ប្រើពាក្យសម្ងាត់ខ្លាំង មិនចែករំលែកលេខកូដ ហើយប្រយ័ត្នចំពោះអ្នកដែលសុំឱ្យអ្នកទិញបញ្ចូលលុយឱ្យពួកគេ — នេះជាការបោកប្រាស់ញឹកញាប់បំផុតក្នុងតំបន់។',
    tags: ['security', 'fraud', 'scam', 'សុវត្ថិភាព'],
  },
  {
    id: 'kb-business',
    titleEn: 'For small businesses and agents',
    titleKm: 'សម្រាប់អាជីវកម្មតូច និងភ្នាក់ងារ',
    bodyEn:
      'Bulk pricing starts at 10 units of the same SKU and unlocks a 3-6% discount automatically at checkout. The admin console exposes a demand forecast, top SKUs and risk review queue so agents can plan stock before Khmer New Year and Pchum Ben peaks.',
    bodyKm:
      'តម្លៃលក់ដុំចាប់ផ្តើមពី 10 គ្រឿងនៃ SKU ដូចគ្នា និងទទួលបានបញ្ចុះតម្លៃ 3-6% ដោយស្វ័យប្រវត្តិពេលបង់ប្រាក់។ ផ្ទាំងអ្នកគ្រប់គ្រងបង្ហាញការព្យាករណ៍តម្រូវការ SKU កំពូល និងជួរត្រួតពិនិត្យហានិភ័យ ដើម្បីឱ្យភ្នាក់ងាររៀបចំស្តុកមុនចូលឆ្នាំ និងភ្ជុំបិណ្ឌ។',
    tags: ['business', 'agent', 'bulk', 'admin', 'អាជីវកម្ម'],
  },
];

const index = new TfidfIndex();
for (const article of KNOWLEDGE_BASE) {
  index.add(
    article.id,
    [article.titleEn, article.titleKm, article.bodyEn, article.bodyKm, article.tags.join(' ')].join(' '),
    article.tags,
  );
}
index.build();

export interface ArticleHit {
  article: KnowledgeArticle;
  score: number;
  snippet: string;
}

export function searchKnowledge(query: string, locale: 'km' | 'en' = 'en', limit = 3): ArticleHit[] {
  const hits = index.search(query, limit);
  return hits.map((hit) => {
    const article = KNOWLEDGE_BASE.find((entry) => entry.id === hit.id)!;
    const body = locale === 'km' ? article.bodyKm : article.bodyEn;
    return { article, score: Number(hit.score.toFixed(3)), snippet: snippetFor(body, query) };
  });
}

/** Return the most query-relevant sentence, falling back to the opening line. */
function snippetFor(body: string, query: string): string {
  const sentences = body.split(/(?<=[។.!?])\s+/).filter(Boolean);
  const queryTokens = new Set(tokenize(query));
  let best = sentences[0] ?? body;
  let bestScore = -1;
  for (const sentence of sentences) {
    const overlap = tokenize(sentence).filter((token) => queryTokens.has(token)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = sentence;
    }
  }
  return best;
}

export const findArticle = (id: string) => KNOWLEDGE_BASE.find((article) => article.id === id);
