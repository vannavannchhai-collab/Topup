import { normalize } from './text.js';

export type Intent =
  | 'greeting'
  | 'discover'
  | 'recommend'
  | 'balance'
  | 'history'
  | 'order_help'
  | 'coverage'
  | 'price'
  | 'bill'
  | 'forecast'
  | 'support'
  | 'smalltalk'
  | 'unknown';

export interface Entities {
  provider?: string;
  amountUsd?: number;
  dataGb?: number;
  days?: number;
  phone?: string;
  language: 'km' | 'en';
  urgency: 'low' | 'normal' | 'high';
}

export interface Understanding {
  intent: Intent;
  confidence: number;
  entities: Entities;
  keywords: string[];
  scores: Record<Intent, number>;
}

const INTENT_PATTERNS: Record<Intent, { en: RegExp[]; km: string[]; weight: number }> = {
  greeting: {
    en: [/^(hi|hello|hey|good (morning|afternoon|evening))\b/i],
    km: ['សួស្តី', 'ជំរាបសួរ', 'ហេឡូ'],
    weight: 1,
  },
  discover: {
    en: [/\b(browse|show|what|which|list|catalog|available|options?|deals?|promo)\b/i],
    km: ['មានអ្វី', 'បង្ហាញ', 'ជម្រើស', 'ប្រូម៉ូសិន', 'តម្លៃប៉ុន្មាន', 'កញ្ចប់', 'សេវា'],
    weight: 1,
  },
  recommend: {
    en: [/\b(recommend|suggest|best|advice|advise|should i|pick|for me|help me choose)\b/i],
    km: ['ណែនាំ', 'សមស្រប', 'គួរជ្រើស', 'ល្អបំផុត', 'ជួយជ្រើស', 'ណាល្អ', 'គួរយក', 'ណាសមស្រប'],
    weight: 1.2,
  },
  balance: {
    en: [/\b(balance|wallet|how much (money|credit)|funds|top ?up my wallet)\b/i],
    km: ['សមតុល្យ', 'កាបូប', 'លុយនៅសល់', 'ទឹកប្រាក់'],
    weight: 1.2,
  },
  history: {
    en: [/\b(history|transactions?|orders?|receipts?|past purchases)\b/i],
    km: ['ប្រវត្តិ', 'ការបញ្ជាទិញ', 'បង្កាន់ដៃ'],
    weight: 1.1,
  },
  order_help: {
    en: [/\b(how (do|to) (i )?(order|buy|pay|top ?up)|steps|process|delivery|how long)\b/i],
    km: ['របៀប', 'ទិញដោយរបៀបណា', 'បញ្ជាទិញ', 'ដំណើរការ'],
    weight: 1,
  },
  coverage: {
    en: [/\b(coverage|network|signal|4g|5g|speed|cover)\b/i],
    km: ['សញ្ញា', 'បណ្តាញ', 'គ្របដណ្តប់', 'ល្បឿន'],
    weight: 1,
  },
  price: {
    en: [/\b(price|cost|how much|cheap|expensive|budget|discount)\b/i],
    km: ['តម្លៃ', 'ថ្លៃ', 'ថោក', 'ប៉ុន្មាន', 'បញ្ចុះតម្លៃ'],
    weight: 1,
  },
  bill: {
    en: [/\b(bills?|electricity|water|utilit(y|ies)|invoices?|pay (my|the) bill)\b/i],
    km: ['វិក្កយបត្រ', 'ភ្លើង', 'ទឹក', 'បង់វិក្កយបត្រ'],
    weight: 1.1,
  },
  forecast: {
    en: [/\b(forecast|predict|trend|next week|expected sales|projection)\b/i],
    km: ['ព្យាករណ៍', 'និន្នាការ', 'រំពឹង'],
    weight: 1.3,
  },
  support: {
    en: [/\b(refunds?|refunded|failed|fail|errors?|problems?|cancel|stuck|not received|support|help|dispute)\b/i],
    km: ['ជួយ', 'បញ្ហា', 'មិនទទួល', 'សងប្រាក់', 'បរាជ័យ'],
    weight: 1.1,
  },
  smalltalk: {
    en: [/\b(thanks|thank you|bye|ok|okay|great|cool|nice)\b/i],
    km: ['អរគុណ', 'លាហើយ', 'អីចឹង'],
    weight: 0.8,
  },
  unknown: { en: [], km: [], weight: 0 },
};

const PROVIDERS = [
  { id: 'cellcard', aliases: ['cellcard', 'mobitel', 'ម៉ូប៊ីតែល', 'សែលកាត'] },
  { id: 'smart', aliases: ['smart', 'smart axiata', 'ស្មាត'] },
  { id: 'metfone', aliases: ['metfone', 'មេតហ្វូន'] },
  { id: 'seatel', aliases: ['seatel', 'ស៊ីតែល'] },
  { id: 'cambodia-post', aliases: ['cambodia post', 'ប្រៃសណីយ៍'] },
];

const KH_PHONE = /(?:\+?855|0)\d{8,9}/;
const AMOUNT_PREFIX = /(?:\$|usd\s?)(\d+(?:\.\d{1,2})?)/i;
const AMOUNT_SUFFIX = /(\d+(?:\.\d{1,2})?)\s?(?:\$|usd\b|dollars?|ដុល្លារ)/i;
const DATA = /(\d+(?:\.\d+)?)\s?(?:gb|giga|ជីបា)/i;
const DAYS = /(\d+)\s?(?:days?|ថ្ងៃ)/i;

export function extractEntities(raw: string): Entities {
  const text = normalize(raw);
  const entities: Entities = {
    language: /[\u1780-\u17FF]/.test(raw) ? 'km' : 'en',
    urgency: 'normal',
  };

  for (const provider of PROVIDERS) {
    if (provider.aliases.some((alias) => text.includes(normalize(alias)))) {
      entities.provider = provider.id;
      break;
    }
  }

  const amount = text.match(AMOUNT_PREFIX) ?? text.match(AMOUNT_SUFFIX);
  if (amount) entities.amountUsd = Number(amount[1]);

  const data = text.match(DATA);
  if (data) entities.dataGb = Number(data[1]);

  const days = text.match(DAYS);
  if (days) entities.days = Number(days[1]);

  const phone = raw.replace(/[\s-]/g, '').match(KH_PHONE);
  if (phone) entities.phone = phone[0];

  if (/\b(urgent|asap|now|immediately)\b/.test(text) || text.includes('បន្ទាន់')) {
    entities.urgency = 'high';
  }

  return entities;
}

export function understand(rawInput: string): Understanding {
  const raw = rawInput.trim();
  const text = normalize(raw);
  const scores = {} as Record<Intent, number>;

  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS) as [
    Intent,
    (typeof INTENT_PATTERNS)[Intent],
  ][]) {
    if (intent === 'unknown') continue;
    let score = 0;
    for (const regex of pattern.en) if (regex.test(raw)) score += pattern.weight;
    for (const keyword of pattern.km) {
      if (text.includes(normalize(keyword))) score += pattern.weight;
    }
    scores[intent] = score;
  }
  scores.unknown = 0.15;

  const entities = extractEntities(raw);
  // Entity-driven boosts: asking with a provider + data term means discovery.
  if (entities.provider) scores.discover += 0.4;
  if (entities.dataGb || /\b(data|internet|gb|bundle)\b/i.test(text) || /អ៊ីនធឺណិត|ទិន្នន័យ|កញ្ចប់/.test(raw)) {
    scores.discover += 0.5;
    scores.price += 0.2;
  }
  if (entities.dataGb || entities.amountUsd) scores.price += 0.3;
  if (/^(hi|hello|hey|សួស្តី)/i.test(raw) && raw.split(/\s+/).length <= 4) {
    scores.greeting += 1.5;
  }

  let bestIntent: Intent = 'unknown';
  let best = 0;
  for (const [intent, score] of Object.entries(scores) as [Intent, number][]) {
    if (score > best) {
      best = score;
      bestIntent = intent;
    }
  }

  const total = Object.values(scores).reduce((sum, value) => sum + value, 0) || 1;
  const confidence = bestIntent === 'unknown' ? 0.25 : Math.min(0.98, 0.45 + (best / total) * 0.6);

  const keywords = text
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1)
    .slice(0, 12);

  return { intent: bestIntent, confidence, entities, keywords, scores };
}
