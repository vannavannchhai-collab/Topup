export interface Wallet {
  balanceCents: number;
  currency: string;
  points: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: 'km' | 'en';
  phone: string | null;
  createdAt: string;
  wallet: Wallet;
}

export interface Product {
  id: string;
  sku: string;
  nameEn: string;
  nameKm: string;
  category: string;
  provider: string;
  faceValueCents: number;
  priceCents: number;
  dataGb: number | null;
  minutes: number | null;
  validityDays: number | null;
  descriptionEn: string;
  descriptionKm: string;
  tags: string[];
  badge: string | null;
  popularity: number;
  score?: number;
  reasonsEn?: string[];
  reasonsKm?: string[];
}

export interface CategorySummary {
  category: string;
  count: number;
  labelEn: string;
  labelKm: string;
}

export interface ProviderSummary {
  id: string;
  en: string;
  km: string;
}

export interface Order {
  id: string;
  reference: string;
  productId: string;
  productNameEn?: string;
  productNameKm?: string;
  recipient: string;
  quantity: number;
  amountCents: number;
  pointsEarned: number;
  status: 'paid' | 'review' | 'refunded' | 'failed';
  deliveryCode: string | null;
  riskScore: number;
  riskFlags: string[];
  channel: string;
  category?: string;
  dataGb?: number | null;
  createdAt: string;
}

export interface RiskFeature {
  key: string;
  labelEn: string;
  labelKm: string;
  value: number;
  weight: number;
  impact: number;
}

export interface RiskAssessment {
  score: number;
  band: 'low' | 'review' | 'high';
  decision: 'allow' | 'review' | 'block';
  explanationEn: string;
  explanationKm: string;
  features: RiskFeature[];
}

export interface Suggestion {
  kind: 'product' | 'action' | 'insight';
  id?: string;
  labelKm: string;
  labelEn: string;
  payload?: Record<string, unknown>;
}

export interface ChatAnswer {
  text: string;
  intent: string;
  confidence: number;
  products: Product[];
  citations: { id: string; titleEn: string; titleKm: string }[];
  suggestions: Suggestion[];
  engine: string;
  latencyMs: number;
  conversationId?: string;
}

export interface Transaction {
  id: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  reference: string | null;
  description: string;
  createdAt: string;
}

export interface ForecastPoint {
  date: string;
  value: number;
  lower?: number;
  upper?: number;
  kind: 'actual' | 'forecast';
}

export interface ForecastResult {
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  mape: number;
  baselineMape: number;
  ensembleWeight: number;
  seasonality: number;
  trendPerDay: number;
  confidence: 'high' | 'medium' | 'low';
  model: string;
}

export interface AdminMetrics {
  revenueCents: number;
  orderCount: number;
  averageOrderCents: number;
  users: number;
  newUsers7d: number;
  reviewQueue: number;
  gmvTodayCents: number;
  gmvGrowth: number;
  daily: { date: string; orders: number; revenue: number }[];
}
