import { q } from '../db/index.js';
import type { Product } from '../types.js';

/**
 * Explainable transaction risk scoring.
 *
 * A calibrated logistic model over behavioural features. Every contribution is
 * surfaced to the customer/admin so a block is never a black box. Thresholds
 * were tuned against synthetic fraud traces during model development.
 */
export interface RiskFeature {
  key: string;
  labelEn: string;
  labelKm: string;
  value: number;
  weight: number;
  impact: number;
}

export interface RiskAssessment {
  score: number; // 0..1
  band: 'low' | 'review' | 'high';
  decision: 'allow' | 'review' | 'block';
  features: RiskFeature[];
  explanationEn: string;
  explanationKm: string;
  flags: string[];
}

const FEATURE_DEFS = {
  amount: { labelEn: 'Order amount vs. usual spend', labelKm: 'ចំនួនទឹកប្រាក់បើប្រៀបធៀបនឹងធម្មតា', weight: 1.9 },
  velocity: { labelEn: 'Recent order velocity', labelKm: 'ចំនួនការបញ្ជាទិញថ្មីៗ', weight: 1.4 },
  accountAge: { labelEn: 'Account age', labelKm: 'អាយុគណនី', weight: 0.9 },
  recipientNovelty: { labelEn: 'New recipient number', labelKm: 'លេខទូរស័ព្ទថ្មី', weight: 1.1 },
  providerMismatch: { labelEn: 'Provider/prefix mismatch', labelKm: 'ប្រភេទបណ្តាញមិនត្រូវគ្នា', weight: 1.3 },
  hourAnomaly: { labelEn: 'Unusual hour', labelKm: 'ម៉ោងមិនធម្មតា', weight: 0.6 },
  quantity: { labelEn: 'Bulk quantity', labelKm: 'ចំនួនច្រើន', weight: 0.8 },
} as const;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

const PREFIX_MAP: Record<string, string[]> = {
  cellcard: ['011', '012', '014', '017', '061', '076', '077', '078', '085', '089', '092', '095', '099'],
  smart: ['010', '015', '016', '069', '070', '081', '086', '087', '093', '096', '098'],
  metfone: ['031', '060', '066', '067', '068', '071', '088', '097'],
  seatel: ['018', '019', '038', '039', '048', '049'],
};

export interface RiskInput {
  userId: string;
  product: Product;
  recipient: string;
  quantity: number;
  amountCents: number;
  now?: Date;
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const now = input.now ?? new Date();
  const history = q.all<{ amount_cents: number; recipient: string; created_at: string }>(
    'SELECT amount_cents, recipient, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 40',
    input.userId,
  );
  const account = q.get<{ created_at: string }>('SELECT created_at FROM users WHERE id = ?', input.userId);

  const features: RiskFeature[] = [];
  const push = (key: keyof typeof FEATURE_DEFS, rawValue: number) => {
    const def = FEATURE_DEFS[key];
    const value = Math.max(-1, Math.min(1, rawValue));
    features.push({ key, labelEn: def.labelEn, labelKm: def.labelKm, value, weight: def.weight, impact: value * def.weight });
  };

  // 1. Amount anomaly relative to the customer's own spend distribution.
  const typical = history.length
    ? history.reduce((sum, order) => sum + order.amount_cents, 0) / history.length
    : 500;
  push('amount', Math.tanh((input.amountCents - typical * 3) / Math.max(typical * 4, 400)));

  // 2. Velocity: orders per hour in the last 60 minutes.
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const recent = history.filter((order) => new Date(order.created_at).getTime() > hourAgo).length;
  push('velocity', (recent - 3) / 4);

  // 3. Account age (fresh accounts carry more risk).
  const ageDays = account
    ? (now.getTime() - new Date(account.created_at).getTime()) / 86_400_000
    : 0;
  push('accountAge', Math.max(0, (3 - ageDays) / 3));

  // 4. Recipient novelty.
  const knownRecipients = new Set(history.map((order) => order.recipient));
  push('recipientNovelty', knownRecipients.has(input.recipient) ? 0 : history.length === 0 ? 0.5 : 0.8);

  // 5. Provider / prefix mismatch.
  const digits = input.recipient.replace(/\D/g, '');
  const local = digits.startsWith('855') ? `0${digits.slice(3)}` : digits;
  const prefix = local.slice(0, 3);
  const expectedPrefixes = PREFIX_MAP[input.product.provider];
  const mismatch = expectedPrefixes && prefix.length === 3 && !expectedPrefixes.includes(prefix) ? 1 : 0;
  push('providerMismatch', mismatch);

  // 6. Unusual hour (deep night in Cambodia, UTC+7).
  const localHour = (now.getUTCHours() + 7) % 24;
  push('hourAnomaly', localHour >= 1 && localHour <= 5 ? 0.7 : 0);

  // 7. Bulk quantity.
  push('quantity', (input.quantity - 2) / 5);

  const bias = -2.35;
  const z = features.reduce((sum, feature) => sum + feature.impact, bias);
  const score = Number(sigmoid(z).toFixed(4));

  const band: RiskAssessment['band'] = score >= 0.72 ? 'high' : score >= 0.42 ? 'review' : 'low';
  const decision: RiskAssessment['decision'] = band === 'high' ? 'block' : band === 'review' ? 'review' : 'allow';

  const flags = features
    .filter((feature) => feature.impact > 0.25)
    .map((feature) => feature.key);

  const topDrivers = [...features].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 2);
  const explanationEn =
    band === 'low'
      ? 'This order matches your normal activity, so it was approved instantly.'
      : `Our risk model flagged ${topDrivers.map((driver) => driver.labelEn.toLowerCase()).join(' and ')}. ${
          decision === 'block' ? 'The order was blocked for your protection.' : 'The order is held for a quick review.'
        }`;
  const explanationKm =
    band === 'low'
      ? 'ការបញ្ជាទិញនេះស្របនឹងសកម្មភាពធម្មតារបស់អ្នក ដូច្នេះវាត្រូវបានអនុម័តភ្លាមៗ។'
      : `គំរូវាយតម្លៃហានិភ័យរបស់យើងបានកត់សម្គាល់ ${topDrivers
          .map((driver) => driver.labelKm)
          .join(' និង ')}។ ${decision === 'block' ? 'ការបញ្ជាទិញត្រូវបានផ្អាក ដើម្បីការពារអ្នក។' : 'ការបញ្ជាទិញកំពុងរង់ចាំការត្រួតពិនិត្យខ្លី។'}`;

  return {
    score,
    band,
    decision,
    features,
    explanationEn,
    explanationKm,
    flags,
  };
}
