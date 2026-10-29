export interface Product {
  id: string;
  sku: string;
  name_en: string;
  name_km: string;
  category: string;
  provider: string;
  face_value_cents: number;
  price_cents: number;
  data_gb: number | null;
  minutes: number | null;
  validity_days: number | null;
  description_en: string;
  description_km: string;
  tags: string;
  badge: string | null;
  popularity: number;
  active: number;
  created_at: string;
}

export interface OrderRow {
  id: string;
  reference: string;
  user_id: string;
  product_id: string;
  recipient: string;
  quantity: number;
  amount_cents: number;
  points_earned: number;
  status: string;
  delivery_code: string | null;
  risk_score: number;
  risk_flags: string;
  channel: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
  phone: string | null;
  created_at: string;
}

export interface WalletRow {
  user_id: string;
  balance_cents: number;
  currency: string;
  points: number;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount_cents: number;
  balance_after_cents: number;
  reference: string | null;
  description: string;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AssistantSuggestion {
  kind: 'product' | 'action' | 'insight';
  id?: string;
  labelKm: string;
  labelEn: string;
  payload?: Record<string, unknown>;
}
