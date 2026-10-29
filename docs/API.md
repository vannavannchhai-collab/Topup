# NOVA API reference

Base URL: `/api` · All bodies are JSON · Authenticated routes need `Authorization: Bearer <jwt>`.

Errors always share one shape:

```json
{ "error": { "code": "bad_request", "message": "Request validation failed", "details": { "issues": [...] } } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `bad_request` | 400 | Validation failed (see `details.issues`) |
| `unauthorized` | 401 | Missing/expired token or bad credentials |
| `insufficient_funds` | 402 | Wallet cannot cover the order (`details.requiredCents`, `details.balanceCents`) |
| `forbidden` | 403 | Authenticated but not allowed (admin routes) |
| `not_found` | 404 | Unknown id/reference |
| `conflict` | 409 | Duplicate email |
| `risk_blocked` | 422 | Fraud model blocked the order (`details.risk`) |
| `rate_limited` | 429 | Slow down |

---

## Health

`GET /api/health`

```json
{ "status": "ok", "service": "nova-topup-ai", "version": "1.0.0",
  "ai": { "engine": "nova-builtin", "model": "nova-retrieval-v1", "demoMode": true } }
```

## Auth

`POST /api/auth/register` — `{ email, password (≥8), name, phone?, locale?, demoFunds? }` → `201 { token, user }`
`POST /api/auth/login` — `{ email, password }` → `{ token, user }`
`GET /api/auth/me` → `{ user, recentTransactions }`
`PATCH /api/auth/me` — `{ name?, locale?, phone? }` → `{ user }`

`user` = `{ id, email, name, role, locale, phone, createdAt, wallet: { balanceCents, currency, points } }`

## Products

`GET /api/products?category&provider&q&sort&min&max`
`sort` ∈ `popularity | price_asc | price_desc | value`

```json
{ "items": [{ "id": "...", "nameEn": "...", "nameKm": "...", "provider": "smart",
              "priceCents": 220, "faceValueCents": 250, "dataGb": 10, "validityDays": 7,
              "badge": "Popular", "tags": ["data","5g"] }],
  "total": 12,
  "categories": [{ "category": "data", "count": 6, "labelEn": "Data bundles", "labelKm": "..." }],
  "providers": [{ "id": "smart", "en": "Smart Axiata", "km": "ស្មាត" }] }
```

`GET /api/products/recommendations?limit=6` → `{ personalized, items[] }` (items add `score`, `reasonsEn`, `reasonsKm` when personalised)
`GET /api/products/categories`
`GET /api/products/:id` → `{ product, related[], providerLabel }`

## Assistant

`POST /api/assistant/chat` — `{ message, locale: "km"|"en", conversationId?, history? }`

```json
{ "text": "…", "intent": "discover", "confidence": 0.82,
  "products": [ … ], "citations": [ { "id": "kb-refund", "titleEn": "…", "titleKm": "…" } ],
  "suggestions": [ { "kind": "product", "id": "…", "labelEn": "…", "payload": { "route": "/shop?product=…" } } ],
  "engine": "nova-builtin", "latencyMs": 4, "conversationId": "…" }
```

`POST /api/assistant/stream` — same body; responds `text/event-stream`:

```
event: conversation
data: {"conversationId":"..."}

event: meta
data: {"intent":"discover","confidence":0.8,"products":[...],"suggestions":[...],"engine":"nova-builtin"}

event: token
data: {"text":"I analysed"}

event: done
data: {"text":"…full answer…","engine":"nova-builtin"}
```

`GET /api/assistant/conversations` → `{ conversations: [{ id, title, updatedAt, messageCount }] }`
`GET /api/assistant/conversations/:id` → `{ conversation, messages[] }`
`DELETE /api/assistant/conversations/:id`

## Wallet

`GET /api/wallet` → `{ balanceCents, points, pointsValueCents, lifetimeInCents, lifetimeOutCents, transactionCount, depositMethods }`
`GET /api/wallet/transactions?limit=30` → `{ items: [{ id, type, amountCents, balanceAfterCents, reference, description, createdAt }] }`
`POST /api/wallet/deposit` — `{ amountCents (100…500000), method: "aba"|"acleda"|"bakong"|"wing"|"card" }` → `201 { reference, balanceCents, creditedCents, feeCents, method }`
`POST /api/wallet/redeem-points` — `{ points (≥100) }` → `{ creditedCents, balanceCents, pointsRemaining }` (1 point = 1 cent)

## Orders

`POST /api/orders/preview` — `{ productId, recipient, quantity? }` → `{ product, amountCents, discountRate, risk }`
`POST /api/orders` — `{ productId, recipient, quantity?, channel?, idempotencyKey? }`

```json
{ "order": { "id": "…", "reference": "NOVA-4J8B-P2SR", "status": "paid",
             "recipient": "012765432", "amountCents": 440, "pointsEarned": 176,
             "deliveryCode": "DAT-…", "riskScore": 0.07, "riskFlags": [] },
  "wallet": { "balanceCents": 3810, "points": 346 },
  "risk": { "score": 0.07, "band": "low", "decision": "allow",
            "explanationEn": "This order matches your normal activity…",
            "features": [ { "key": "amount", "labelEn": "Order amount vs. usual spend", "impact": -0.2 } ] } }
```

Replaying the same `idempotencyKey` returns `{ order, replayed: true }` with the original order.

`GET /api/orders?limit=25` → `{ items[], totals: { amountCents, orders } }`
`GET /api/orders/:reference` → `{ order }`

## Insights

`GET /api/insights` → `{ insights: [{ id, tone, titleEn, titleKm, bodyEn, bodyKm, metric?, actionRoute? }] }`

## Help centre

`GET /api/help/articles?q&locale` → `{ items: [{ id, titleEn, titleKm, bodyEn, bodyKm, tags, score? }] }`

## Admin (role `admin` required)

`GET /api/admin/metrics` → revenue, order count, AOV, users, review queue, today's GMV + growth, 45-day series
`GET /api/admin/forecast?horizon=7` → `{ revenue, revenueDirect, orders }` (all `ForecastResult`; `revenue` is the decomposed `orders × AOV` model, `revenueDirect` the raw fit kept as a benchmark)

```json
{ "history": [{ "date": "2026-10-01", "value": 12, "kind": "actual" }],
  "forecast": [{ "date": "2026-10-30", "value": 14, "lower": 9, "upper": 19, "kind": "forecast" }],
  "errorPct": 12.4, "baselineErrorPct": 21.4, "errorMetric": "WAPE", "transform": "log1p",
  "ensembleWeight": 0.84,
  "seasonality": 7, "trendPerDay": 0.31, "confidence": "high",
  "model": "Log-linear Holt-Winters 84% + seasonal-naive 16% (m=7)" }
```

`GET /api/admin/top-products` → top 12 by revenue
`GET /api/admin/risk-queue` → orders with `status = review` or `risk_score ≥ 0.42`
`POST /api/admin/risk-queue/:id/decision` — `{ action: "approve" | "reject" }` (reject refunds the wallet)
`GET /api/admin/customers` → top 50 by spend
`GET /api/admin/assistant-stats` → `{ questions, averageLatencyMs, intents: [{ intent, count }] }`

## Rate limits

| Scope | Default |
|---|---|
| Global per IP+identity, per minute | 240 |
| `/api/assistant/*` per user, per minute | 40 |
| `/api/auth/login` per IP, per minute | 15 |
