import { q, resetDatabase } from './index.js';
import { hashPassword } from '../lib/password.js';
import { uuid, deliveryCode, reference } from '../lib/ids.js';
import { log } from '../lib/logger.js';
import { refreshCatalogIndex } from '../ai/catalog.js';
import type { Product } from '../types.js';

interface SeedProduct {
  sku: string;
  nameEn: string;
  nameKm: string;
  category: string;
  provider: string;
  faceValueCents: number;
  priceCents: number;
  dataGb?: number;
  minutes?: number;
  validityDays?: number;
  descriptionEn: string;
  descriptionKm: string;
  tags: string[];
  badge?: string;
  popularity: number;
}

const dollars = (value: number) => Math.round(value * 100);

const CATALOG: SeedProduct[] = [
  // ── Mobile top-up ────────────────────────────────────────────────────────
  ...([
    ['cellcard', 'Cellcard', 'សែលកាត', [1, 2, 5, 10, 20]],
    ['smart', 'Smart Axiata', 'ស្មាត', [1, 2, 5, 10, 20]],
    ['metfone', 'Metfone', 'មេតហ្វូន', [1, 2, 5, 10]],
    ['seatel', 'Seatel', 'ស៊ីតេល', [1, 5, 10]],
  ] as const).flatMap(([provider, nameEn, nameKm, amounts]) =>
    amounts.map<SeedProduct>((amount, index) => ({
      sku: `${provider}-topup-${amount}`,
      nameEn: `${nameEn} $${amount} top-up`,
      nameKm: `បញ្ចូលលុយ ${nameKm} $${amount}`,
      category: 'mobile',
      provider,
      faceValueCents: dollars(amount),
      priceCents: dollars(amount * (amount >= 10 ? 0.97 : 1)),
      validityDays: 30,
      descriptionEn: `Instant ${nameEn} credit of $${amount}. Works on prepaid and Serey+ numbers, delivered in under 10 seconds.`,
      descriptionKm: `បញ្ចូលលុយ ${nameKm} $${amount} ភ្លាមៗ។ ប្រើបានលើលេខបង់ប្រាក់មុន និង Serey+ ដោយដឹកជញ្ជូនក្នុងរយៈពេលតិចជាង 10 វិនាទី។`,
      tags: ['topup', 'airtime', 'prepaid', provider, nameEn.toLowerCase()],
      badge: index === amounts.length - 1 ? 'Best value' : undefined,
      popularity: 0.95 - index * 0.06 - (provider === 'seatel' ? 0.2 : 0),
    })),
  ),

  // ── Data bundles ────────────────────────────────────────────────────────
  {
    sku: 'smart-data-1d-1gb',
    nameEn: 'Smart 1GB / 1 day',
    nameKm: 'ស្មាត 1GB / 1 ថ្ងៃ',
    category: 'data',
    provider: 'smart',
    faceValueCents: dollars(0.5),
    priceCents: dollars(0.4),
    dataGb: 1,
    validityDays: 1,
    descriptionEn: 'Daily 1GB high-speed data on the Smart network. Perfect for a quick browse or map session.',
    descriptionKm: 'អ៊ីនធឺណិតល្បឿនលឿន 1GB ប្រចាំថ្ងៃលើបណ្តាញ Smart។ សមស្របសម្រាប់រកមើលផែនទី ឬអានព័ត៌មានរហ័ស។',
    tags: ['data', 'internet', 'daily', 'smart', '1gb'],
    popularity: 0.9,
  },
  {
    sku: 'smart-data-7d-10gb',
    nameEn: 'Smart 10GB / 7 days',
    nameKm: 'ស្មាត 10GB / 7 ថ្ងៃ',
    category: 'data',
    provider: 'smart',
    faceValueCents: dollars(2.5),
    priceCents: dollars(2.2),
    dataGb: 10,
    validityDays: 7,
    descriptionEn: 'Weekly 10GB bundle with 5G access in Phnom Penh, Siem Reap and Sihanoukville.',
    descriptionKm: 'កញ្ចប់ 10GB ប្រចាំសប្តាហ៍ ជាមួយ 5G នៅភ្នំពេញ សៀមរាប និងព្រះសីហនុ។',
    tags: ['data', 'internet', 'weekly', 'smart', '5g', '10gb'],
    badge: 'Popular',
    popularity: 0.97,
  },
  {
    sku: 'cellcard-data-30d-25gb',
    nameEn: 'Cellcard 25GB / 30 days',
    nameKm: 'សែលកាត 25GB / 30 ថ្ងៃ',
    category: 'data',
    provider: 'cellcard',
    faceValueCents: dollars(6),
    priceCents: dollars(5.25),
    dataGb: 25,
    validityDays: 30,
    descriptionEn: 'Monthly 25GB bundle plus 100 free on-net minutes. Great for remote work and video calls.',
    descriptionKm: 'កញ្ចប់ 25GB ប្រចាំខែ ព្រមទាំងពេលហៅក្នុងបណ្តាញ 100 នាទី។ សមស្របសម្រាប់ការងារពីចម្ងាយ និងការហៅវីដេអូ។',
    tags: ['data', 'internet', 'monthly', 'cellcard', '25gb'],
    popularity: 0.88,
  },
  {
    sku: 'metfone-data-30d-40gb',
    nameEn: 'Metfone 40GB / 30 days',
    nameKm: 'មេតហ្វូន 40GB / 30 ថ្ងៃ',
    category: 'data',
    provider: 'metfone',
    faceValueCents: dollars(8),
    priceCents: dollars(7.2),
    dataGb: 40,
    validityDays: 30,
    descriptionEn: 'The widest rural coverage in Cambodia with 40GB for the month and unlimited on-net calls.',
    descriptionKm: 'បណ្តាញជនបទធំទូលាយបំផុតក្នុងកម្ពុជា ជាមួយ 40GB ប្រចាំខែ និងការហៅក្នុងបណ្តាញគ្មានដែនកំណត់។',
    tags: ['data', 'internet', 'monthly', 'metfone', 'rural', '40gb'],
    popularity: 0.82,
  },
  {
    sku: 'cellcard-data-7d-8gb',
    nameEn: 'Cellcard 8GB / 7 days',
    nameKm: 'សែលកាត 8GB / 7 ថ្ងៃ',
    category: 'data',
    provider: 'cellcard',
    faceValueCents: dollars(2),
    priceCents: dollars(1.7),
    dataGb: 8,
    validityDays: 7,
    descriptionEn: 'Weekly 8GB bundle for streaming and social apps, with free YouTube data between 10pm-6am.',
    descriptionKm: 'កញ្ចប់ 8GB ប្រចាំសប្តាហ៍សម្រាប់មើលវីដេអូ និងបណ្តាញសង្គម ជាមួយទិន្នន័យ YouTube ឥតគិតថ្លៃពី 22:00 ដល់ 06:00។',
    tags: ['data', 'internet', 'weekly', 'cellcard', '8gb'],
    popularity: 0.86,
  },

  // ── Gaming ──────────────────────────────────────────────────────────────
  {
    sku: 'mlbb-86-diamonds',
    nameEn: 'Mobile Legends 86 Diamonds',
    nameKm: 'Mobile Legends 86 ពេជ្រ',
    category: 'gaming',
    provider: 'moonton',
    faceValueCents: dollars(1),
    priceCents: dollars(0.95),
    descriptionEn: '86 diamonds for Mobile Legends: Bang Bang, credited to your Moonton ID instantly.',
    descriptionKm: 'ពេជ្រ 86 សម្រាប់ Mobile Legends: Bang Bang បញ្ចូលទៅ ID Moonton របស់អ្នកភ្លាមៗ។',
    tags: ['game', 'mlbb', 'diamonds', 'moonton', 'mobile legends'],
    popularity: 0.93,
  },
  {
    sku: 'mlbb-432-diamonds',
    nameEn: 'Mobile Legends 432 Diamonds',
    nameKm: 'Mobile Legends 432 ពេជ្រ',
    category: 'gaming',
    provider: 'moonton',
    faceValueCents: dollars(5),
    priceCents: dollars(4.7),
    descriptionEn: '432 diamonds — best value pack for skins and the monthly Starlight pass.',
    descriptionKm: 'ពេជ្រ 432 — កញ្ចប់តម្លៃល្អបំផុតសម្រាប់ស្គីន និង Starlight ប្រចាំខែ។',
    tags: ['game', 'mlbb', 'diamonds', 'moonton', 'mobile legends'],
    badge: 'Top seller',
    popularity: 0.96,
  },
  {
    sku: 'freefire-520-diamonds',
    nameEn: 'Free Fire 520 Diamonds',
    nameKm: 'Free Fire 520 ពេជ្រ',
    category: 'gaming',
    provider: 'garena',
    faceValueCents: dollars(4),
    priceCents: dollars(3.75),
    descriptionEn: '520 Free Fire diamonds for Garena accounts, delivered by player ID.',
    descriptionKm: 'ពេជ្រ 520 សម្រាប់ Free Fire តាម ID អ្នកលេង Garena។',
    tags: ['game', 'freefire', 'garena', 'diamonds'],
    popularity: 0.9,
  },
  {
    sku: 'pubg-60-uc',
    nameEn: 'PUBG Mobile 60 UC',
    nameKm: 'PUBG Mobile 60 UC',
    category: 'gaming',
    provider: 'garena',
    faceValueCents: dollars(1),
    priceCents: dollars(0.92),
    descriptionEn: '60 Unknown Cash for PUBG Mobile. Enter your character ID at checkout.',
    descriptionKm: '60 UC សម្រាប់ PUBG Mobile។ បញ្ចូល Character ID របស់អ្នកពេលបង់ប្រាក់។',
    tags: ['game', 'pubg', 'uc', 'garena'],
    popularity: 0.78,
  },
  {
    sku: 'genshin-300-crystals',
    nameEn: 'Genshin Impact 300 Genesis Crystals',
    nameKm: 'Genshin Impact 300 Genesis Crystals',
    category: 'gaming',
    provider: 'google',
    faceValueCents: dollars(5),
    priceCents: dollars(4.75),
    descriptionEn: '300 Genesis Crystals for Genshin Impact, delivered to your UID.',
    descriptionKm: '300 Genesis Crystals សម្រាប់ Genshin Impact ដឹកជញ្ជូនទៅ UID របស់អ្នក។',
    tags: ['game', 'genshin', 'crystals', 'google'],
    popularity: 0.7,
  },

  // ── Bills ───────────────────────────────────────────────────────────────
  {
    sku: 'edc-electricity-10',
    nameEn: 'EDC electricity $10',
    nameKm: 'អគ្គិសនី EDC $10',
    category: 'bills',
    provider: 'edc',
    faceValueCents: dollars(10),
    priceCents: dollars(10),
    descriptionEn: 'Pay your Electricité du Cambodge bill instantly with your client code.',
    descriptionKm: 'បង់វិក្កយបត្រអគ្គិសនីកម្ពុជា (EDC) ភ្លាមៗ ដោយប្រើលេខកូដអតិថិជន។',
    tags: ['bill', 'electricity', 'edc', 'utility'],
    popularity: 0.84,
  },
  {
    sku: 'edc-electricity-25',
    nameEn: 'EDC electricity $25',
    nameKm: 'អគ្គិសនី EDC $25',
    category: 'bills',
    provider: 'edc',
    faceValueCents: dollars(25),
    priceCents: dollars(25),
    descriptionEn: 'Top up a larger EDC electricity account, ideal for shops and cafés.',
    descriptionKm: 'បញ្ចូលគណនីអគ្គិសនី EDC ចំនួនធំ សមស្របសម្រាប់ហាង និងកាហ្វេ។',
    tags: ['bill', 'electricity', 'edc', 'shop'],
    popularity: 0.68,
  },
  {
    sku: 'ppwsa-water-5',
    nameEn: 'Phnom Penh Water $5',
    nameKm: 'ទឹកស្អាតភ្នំពេញ $5',
    category: 'bills',
    provider: 'ppwsa',
    faceValueCents: dollars(5),
    priceCents: dollars(5),
    descriptionEn: 'Settle your PPWSA water bill using your 9-digit customer reference.',
    descriptionKm: 'បង់វិក្កយបត្រទឹកស្អាតភ្នំពេញ ដោយប្រើលេខយោងអតិថិជន 9 ខ្ទង់។',
    tags: ['bill', 'water', 'ppwsa', 'utility'],
    popularity: 0.62,
  },
  {
    sku: 'isp-home-internet-15',
    nameEn: 'Home internet bill $15',
    nameKm: 'វិក្កយបត្រអ៊ីនធឺណិតផ្ទះ $15',
    category: 'bills',
    provider: 'isp',
    faceValueCents: dollars(15),
    priceCents: dollars(15),
    descriptionEn: 'Pay any major home fibre provider (Sinet, MekongNet, NTC) from one screen.',
    descriptionKm: 'បង់វិក្កយបត្រអ៊ីនធឺណិតផ្ទះធំៗ (Sinet, MekongNet, NTC) ពីអេក្រង់តែមួយ។',
    tags: ['bill', 'internet', 'fibre', 'isp'],
    popularity: 0.6,
  },

  // ── Entertainment ───────────────────────────────────────────────────────
  {
    sku: 'netflix-mobile-1m',
    nameEn: 'Netflix Mobile 1 month',
    nameKm: 'Netflix Mobile 1 ខែ',
    category: 'entertainment',
    provider: 'netflix',
    faceValueCents: dollars(4.5),
    priceCents: dollars(4.2),
    validityDays: 30,
    descriptionEn: 'One month of Netflix Mobile with downloads, on a single phone or tablet.',
    descriptionKm: 'Netflix Mobile មួយខែ ជាមួយការទាញយក សម្រាប់ទូរស័ព្ទ ឬ Tablet មួយ។',
    tags: ['netflix', 'streaming', 'subscription', 'movie'],
    popularity: 0.75,
  },
  {
    sku: 'spotify-premium-1m',
    nameEn: 'Spotify Premium 1 month',
    nameKm: 'Spotify Premium 1 ខែ',
    category: 'entertainment',
    provider: 'spotify',
    faceValueCents: dollars(3.5),
    priceCents: dollars(3.3),
    validityDays: 30,
    descriptionEn: 'Ad-free music, offline listening and unlimited skips for 30 days.',
    descriptionKm: 'តន្ត្រីគ្មានការផ្សាយពាណិជ្ជកម្ម ស្តាប់ក្រៅបណ្តាញ និងរំលងគ្មានដែនកំណត់ រយៈពេល 30 ថ្ងៃ។',
    tags: ['spotify', 'music', 'streaming', 'subscription'],
    popularity: 0.72,
  },
  {
    sku: 'google-play-10',
    nameEn: 'Google Play $10',
    nameKm: 'Google Play $10',
    category: 'entertainment',
    provider: 'google',
    faceValueCents: dollars(10),
    priceCents: dollars(9.6),
    descriptionEn: 'Google Play gift code for apps, games and in-app purchases.',
    descriptionKm: 'កូដ Google Play សម្រាប់កម្មវិធី ហ្គេម និងការទិញក្នុងកម្មវិធី។',
    tags: ['google play', 'gift card', 'apps', 'games'],
    popularity: 0.8,
  },

  // ── Travel eSIM ─────────────────────────────────────────────────────────
  {
    sku: 'esim-asia-3d-3gb',
    nameEn: 'Asia eSIM 3GB / 3 days',
    nameKm: 'eSIM អាស៊ី 3GB / 3 ថ្ងៃ',
    category: 'esim',
    provider: 'nova',
    faceValueCents: dollars(6),
    priceCents: dollars(5.4),
    dataGb: 3,
    validityDays: 3,
    descriptionEn: 'Scan-and-go eSIM covering Cambodia, Thailand and Vietnam. No roaming fees.',
    descriptionKm: 'eSIM ស្កេនហើយប្រើ គ្របដណ្តប់កម្ពុជា ថៃ និងវៀតណាម។ គ្មានថ្លៃរ៉ូមីង។',
    tags: ['esim', 'travel', 'roaming', 'asia', 'data'],
    badge: 'New',
    popularity: 0.66,
  },
  {
    sku: 'esim-global-30d-10gb',
    nameEn: 'Global eSIM 10GB / 30 days',
    nameKm: 'eSIM សកល 10GB / 30 ថ្ងៃ',
    category: 'esim',
    provider: 'nova',
    faceValueCents: dollars(18),
    priceCents: dollars(16.2),
    dataGb: 10,
    validityDays: 30,
    descriptionEn: 'One eSIM, 90+ countries, 10GB of high-speed data for a month.',
    descriptionKm: 'eSIM មួយ គ្របដណ្តប់ជាង 90 ប្រទេស ជាមួយ 10GB ទិន្នន័យល្បឿនលឿនមួយខែ។',
    tags: ['esim', 'travel', 'global', 'data'],
    popularity: 0.58,
  },
];

const EXTRA_USERS = [
  { name: 'Sophea Chan', email: 'sophea@example.com' },
  { name: 'Dara Vann', email: 'dara@example.com' },
  { name: 'Mealea Sok', email: 'mealea@example.com' },
  { name: 'Rithy Heng', email: 'rithy@example.com' },
  { name: 'Bopha Lim', email: 'bopha@example.com' },
  { name: 'Kosal Phan', email: 'kosal@example.com' },
  { name: 'Sreyneang Yim', email: 'sreyneang@example.com' },
  { name: 'Vibol Touch', email: 'vibol@example.com' },
];

/** Deterministic PRNG so demo analytics are stable across reseeds. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RECIPIENTS = [
  '010123456', '012765432', '015998877', '016445566', '017332211',
  '069887766', '070112233', '081445566', '086667788', '093887799',
  '096112244', '098667788', '097334455', '088776655', '031556677',
];

export async function ensureSeed(): Promise<void> {
  const existing = q.get<{ count: number }>('SELECT COUNT(*) AS count FROM products')?.count ?? 0;
  if (existing > 0) {
    log.info('seed skipped — catalog already populated');
    return;
  }
  await seedAll({ destructive: false });
}

export async function seedAll({ destructive = true }: { destructive?: boolean } = {}): Promise<void> {
  if (destructive) resetDatabase();
  const now = new Date();

  // ── Products ────────────────────────────────────────────────────────────
  for (const seed of CATALOG) {
    q.run(
      `INSERT INTO products (id, sku, name_en, name_km, category, provider, face_value_cents, price_cents,
        data_gb, minutes, validity_days, description_en, description_km, tags, badge, popularity, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      uuid(),
      seed.sku,
      seed.nameEn,
      seed.nameKm,
      seed.category,
      seed.provider,
      seed.faceValueCents,
      seed.priceCents,
      seed.dataGb ?? null,
      seed.minutes ?? null,
      seed.validityDays ?? null,
      seed.descriptionEn,
      seed.descriptionKm,
      seed.tags.join(','),
      seed.badge ?? null,
      seed.popularity,
      now.toISOString(),
    );
  }

  // ── Demo accounts ───────────────────────────────────────────────────────
  const accounts = [
    { name: 'NOVA Admin', email: 'admin@nova.ai', password: 'Admin@123', role: 'admin', balance: 250_00, createdOffset: 120 },
    { name: 'Sokha Demo', email: 'demo@nova.ai', password: 'Demo@1234', role: 'customer', balance: 42_50, createdOffset: 90 },
    ...EXTRA_USERS.map((user, index) => ({
      ...user,
      password: 'Demo@1234',
      role: 'customer',
      balance: 12_00 + index * 3_00,
      createdOffset: 80 - index * 7,
    })),
  ];

  const userIds: { id: string; email: string }[] = [];
  for (const account of accounts) {
    const createdAt = new Date(now.getTime() - account.createdOffset * 86_400_000).toISOString();
    const id = uuid();
    q.run(
      'INSERT INTO users (id, email, password_hash, name, role, phone, locale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      account.email,
      await hashPassword(account.password),
      account.name,
      account.role,
      RECIPIENTS[userIds.length % RECIPIENTS.length],
      userIds.length % 3 === 0 ? 'en' : 'km',
      createdAt,
    );
    q.run(
      'INSERT INTO wallets (user_id, balance_cents, currency, points, updated_at) VALUES (?, ?, ?, ?, ?)',
      id,
      account.balance,
      'USD',
      Math.round(account.balance / 25),
      createdAt,
    );
    q.run(
      `INSERT INTO transactions (id, user_id, type, amount_cents, balance_after_cents, reference, description, created_at)
       VALUES (?, ?, 'deposit', ?, ?, ?, 'Initial wallet funding', ?)`,
      uuid(),
      id,
      account.balance,
      account.balance,
      reference('DEP'),
      createdAt,
    );
    userIds.push({ id, email: account.email });
  }

  // ── Synthetic order history (45 days, seasonal, trending) ───────────────
  const products = q.all<Product>('SELECT * FROM products');
  const random = mulberry32(20261029);
  const customers = userIds.slice(1); // skip admin
  const pickProduct = (): Product => {
    const weighted = products.map((product) => ({ product, weight: Math.pow(product.popularity, 2.2) }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.product;
    }
    return products[0];
  };

  let orderCount = 0;
  for (let dayOffset = 44; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const weekday = day.getDay(); // 0 Sun ... 6 Sat
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.45 : 1;
    const growth = 1 + (44 - dayOffset) / 44 * 0.85; // steady upward trend
    const baseOrders = 5.5 * weekendBoost * growth;
    const count = Math.max(1, Math.round(baseOrders + (random() - 0.5) * 3));

    for (let i = 0; i < count; i += 1) {
      const customer = customers[Math.floor(random() * customers.length)];
      const product = pickProduct();
      const quantity = random() > 0.92 ? 2 + Math.floor(random() * 4) : 1;
      const createdAt = new Date(day);
      createdAt.setHours(8 + Math.floor(random() * 13), Math.floor(random() * 60), 0, 0);
      const amount = Math.round(product.price_cents * quantity * (quantity >= 10 ? 0.97 : 1));
      const statusRoll = random();
      const status = statusRoll > 0.975 ? 'refunded' : statusRoll > 0.94 ? 'review' : 'paid';
      const risk = Number((random() * (status === 'paid' ? 0.35 : 0.85)).toFixed(2));
      q.run(
        `INSERT INTO orders (id, reference, user_id, product_id, recipient, quantity, amount_cents, points_earned,
          status, delivery_code, risk_score, risk_flags, channel, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`,
        uuid(),
        reference(),
        customer.id,
        product.id,
        RECIPIENTS[Math.floor(random() * RECIPIENTS.length)],
        quantity,
        amount,
        Math.round((amount / 100) * 40),
        status,
        status === 'paid' ? deliveryCode(product.category) : null,
        risk,
        random() > 0.75 ? 'assistant' : 'web',
        createdAt.toISOString(),
      );
      if (status !== 'refunded') {
        q.run(
          `INSERT INTO transactions (id, user_id, type, amount_cents, balance_after_cents, reference, description, created_at)
           VALUES (?, ?, 'purchase', ?, 0, ?, ?, ?)`,
          uuid(),
          customer.id,
          -amount,
          reference(),
          `${product.name_en} x${quantity}`,
          createdAt.toISOString(),
        );
      }
      orderCount += 1;
    }
  }

  // ── A richer starter conversation for the demo customer ─────────────────
  const demoUser = userIds[1];
  if (demoUser) {
    const conversationId = uuid();
    const createdAt = new Date(now.getTime() - 3_600_000).toISOString();
    q.run(
      'INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      conversationId,
      demoUser.id,
      'Weekly data bundle advice',
      createdAt,
      createdAt,
    );
    const script: [string, string][] = [
      ['user', 'តើកញ្ចប់អ៊ីនធឺណិតណាល្អសម្រាប់ខ្ញុំ?'],
      [
        'assistant',
        'សួស្តី! ផ្អែកលើការប្រើប្រាស់របស់អ្នក NOVA ណែនាំ Smart 10GB / 7 ថ្ងៃ ក្នុងតម្លៃ $2.20 — វាស្របនឹងថវិកាធម្មតារបស់អ្នក និងមាន 5G នៅសៀមរាប។',
      ],
      ['user', 'How do I pay?'],
      [
        'assistant',
        'Tap "Pay with wallet" and the bundle is delivered in seconds. Your delivery code appears in Order history right away.',
      ],
    ];
    script.forEach(([role, content], index) => {
      q.run(
        'INSERT INTO messages (id, conversation_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        uuid(),
        conversationId,
        role,
        content,
        '{}',
        new Date(now.getTime() - 3_600_000 + index * 60_000).toISOString(),
      );
    });
  }

  refreshCatalogIndex();
  log.info('seed complete', {
    products: products.length,
    users: userIds.length,
    orders: orderCount,
  });
}

const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  await seedAll();
  log.info('✅ demo data seeded — login with demo@nova.ai / Demo@1234 or admin@nova.ai / Admin@123');
}
