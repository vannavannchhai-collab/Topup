/**
 * Language utilities for NOVA's retrieval engine.
 *
 * Khmer is written without spaces between words, so classic whitespace
 * tokenisation fails. We emit character n-grams for Khmer runs and stemmed
 * word tokens for Latin script, then score with BM25 + cosine similarity.
 */

const KHMER_RANGE = /[\u1780-\u17FF\u19E0-\u19FF]/;

export const STOPWORDS = new Set([
  'the','a','an','and','or','of','to','for','in','on','at','is','are','be','i','me','my','we','you',
  'your','it','this','that','with','do','does','can','could','would','should','how','what','which',
  'please','want','need','get','have','has','បាន','ហើយ','គឺ','និង','ឬ','ក្នុង','លើ','ទៅ','ខ្ញុំ','អ្នក',
  'យើង','មួយ','ណា','អី','អ្វី','ថា','ប៉ុន្មាន','ចង់','ត្រូវ','មាន','ជា','នេះ','នោះ','ខ្ញុំ','គាត់',
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Very light English stemmer: plural + common verb suffixes. */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ers') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('s') && !word.endsWith('ss')) {
    // "bundles" → "bundle", but "boxes"/"churches"/"buses" drop the whole -es.
    const withoutS = word.slice(0, -1);
    if (word.endsWith('es') && /(s|x|z|ch|sh)$/.test(withoutS)) return withoutS.slice(0, -1);
    return withoutS;
  }
  return word;
}

const splitter = /[^\p{L}\p{N}\p{M}]+/u;

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of normalize(text).split(splitter)) {
    if (!raw) continue;
    if (KHMER_RANGE.test(raw)) {
      // Khmer: unigram + bigram + trigram character shingles.
      const chars = Array.from(raw);
      for (const ch of chars) tokens.push(ch);
      for (let i = 0; i < chars.length - 1; i += 1) tokens.push(chars[i] + chars[i + 1]);
      for (let i = 0; i < chars.length - 2; i += 1) tokens.push(chars[i] + chars[i + 1] + chars[i + 2]);
      tokens.push(raw);
    } else if (/^\d+$/.test(raw)) {
      tokens.push(raw);
    } else if (!STOPWORDS.has(raw)) {
      tokens.push(stem(raw));
    }
  }
  return tokens;
}

export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
  return tf;
}

/** Sparse TF-IDF vector: token -> weight. */
export type Vector = Map<string, number>;

export class TfidfIndex {
  private df = new Map<string, number>();
  private docCount = 0;
  private docs: { id: string; vector: Vector; tokens: string[] }[] = [];

  constructor(private idfSmoothing = 1) {}

  add(id: string, text: string, boostTerms: string[] = []): void {
    const tokens = [...tokenize(text), ...boostTerms.flatMap((term) => tokenize(term))];
    const tf = termFrequency(tokens);
    for (const token of tf.keys()) this.df.set(token, (this.df.get(token) ?? 0) + 1);
    this.docCount += 1;
    this.docs.push({ id, vector: new Map(), tokens });
  }

  build(): this {
    for (const doc of this.docs) {
      const tf = termFrequency(doc.tokens);
      const max = Math.max(...tf.values(), 1);
      const vector: Vector = new Map();
      for (const [token, count] of tf) {
        const idf = Math.log(
          (this.docCount + this.idfSmoothing) /
            ((this.df.get(token) ?? 0) + this.idfSmoothing),
        ) + 1;
        vector.set(token, (count / max) * idf);
      }
      doc.vector = vector;
    }
    return this;
  }

  vectorize(text: string): Vector {
    const tf = termFrequency(tokenize(text));
    const max = Math.max(...tf.values(), 1);
    const vector: Vector = new Map();
    for (const [token, count] of tf) {
      const idf = Math.log(
        (this.docCount + this.idfSmoothing) / ((this.df.get(token) ?? 0) + this.idfSmoothing),
      ) + 1;
      vector.set(token, (count / max) * idf);
    }
    return vector;
  }

  search(query: string, limit = 8): { id: string; score: number }[] {
    const queryVector = this.vectorize(query);
    const results = this.docs.map((doc) => ({
      id: doc.id,
      score: cosine(queryVector, doc.vector),
    }));
    return results
      .filter((result) => result.score > 0.01)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  get size(): number {
    return this.docCount;
  }
}

export function cosine(a: Vector, b: Vector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [token, weight] of small) {
    const other = large.get(token);
    if (other) dot += weight * other;
  }
  for (const weight of a.values()) normA += weight * weight;
  for (const weight of b.values()) normB += weight * weight;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Bilingual synonym expansion so Khmer queries hit English catalog copy. */
export const SYNONYMS: Record<string, string[]> = {
  ទូរស័ព្ទ: ['phone', 'mobile', 'topup'],
  បញ្ចូលលុយ: ['topup', 'top up', 'recharge', 'refill'],
  អ៊ីនធឺណិត: ['internet', 'data', 'bundle'],
  ទិន្នន័យ: ['data', 'internet', 'gb'],
  អាកាសចរណ៍: ['smart', 'provider'],
  ហ្គេម: ['game', 'gaming'],
  វិក្កយបត្រ: ['bill', 'utility', 'invoice'],
  ថ្លៃទឹក: ['water', 'bill'],
  ថ្លៃភ្លើង: ['electricity', 'bill', 'power'],
  សំបុត្រ: ['ticket', 'voucher'],
  ឆ្លាតវៃ: ['smart'],
  មាត់ជាយ: ['cellcard', 'metfone'],
  mobile: ['phone', 'topup'],
  internet: ['data', 'bundle'],
  recharge: ['topup', 'refill'],
  cheap: ['budget', 'discount', 'value'],
  ថោក: ['cheap', 'budget', 'discount'],
  bonus: ['promotion', 'extra'],
  បន្ថែម: ['bonus', 'extra', 'topup'],
};

export function expandQuery(query: string): string {
  const normalized = normalize(query);
  const extras = new Set<string>();
  for (const [term, expansions] of Object.entries(SYNONYMS)) {
    if (normalized.includes(normalize(term))) {
      for (const expansion of expansions) extras.add(expansion);
    }
  }
  return extras.size ? `${query} ${[...extras].join(' ')}` : query;
}
