# NOVA architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite)                                           │
│  Home · Shop · Assistant(SSE) · Wallet · Orders · Admin · Help       │
│  i18n (km/en) · Auth context · toast · SVG charts (no chart lib)      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ fetch /api (Bearer JWT) + SSE
┌───────────────────────────────▼──────────────────────────────────────┐
│  Express 5 API                                                       │
│  middleware: cors → json → rateLimit → auth → zod validate           │
│  routes: auth products assistant wallet orders admin help insights   │
├──────────────────────────────────────────────────────────────────────┤
│  AI layer                                                            │
│  nlu ─┬─ text (TF-IDF, Khmer n-grams) ─┬─ catalog (index)            │
│       ├─ recommend (hybrid profile)    ├─ knowledge (bilingual KB)   │
│       ├─ risk (logistic, explainable)  ├─ forecast (HW ensemble)     │
│       └─ insights (rules over ledger)  └─ assistant (composer/RAG)   │
├──────────────────────────────────────────────────────────────────────┤
│  Data layer: node:sqlite · WAL · savepoint transactions · migrations │
└──────────────────────────────────────────────────────────────────────┘
```

## Data model

| Table | Purpose | Notes |
|---|---|---|
| `users` | accounts | scrypt hash, role (`customer` / `admin`), locale |
| `wallets` | balance + points | money in **integer cents** |
| `products` | catalogue | bilingual name/description, `price_cents`, `face_value_cents`, popularity prior |
| `orders` | purchases | reference, delivery code, risk score + flags, idempotency key (unique per user) |
| `transactions` | append-only ledger | `amount_cents` signed, `balance_after_cents` snapshot |
| `conversations` / `messages` | assistant memory | message `meta` stores intent, product ids, engine |
| `events` | analytics | order_created, wallet_deposit, assistant_answer |

Migrations are additive and idempotent: `migrate()` in `server/src/db/index.ts` inspects `PRAGMA table_info` and back-fills columns for older databases, then applies dependent indexes from `POST_MIGRATION_SQL`.

## Key flows

### 1. Purchase (with risk + idempotency)

```
POST /api/orders {productId, recipient, quantity, idempotencyKey}
  ├─ zod validate
  ├─ idempotency lookup (user_id, key) → replay original order
  ├─ compute bulk discount (0 / 3% / 4.5% / 6%)
  ├─ assessRisk() → allow | review | block
  │    block → 422 risk_blocked (with full explanation payload)
  ├─ BEGIN IMMEDIATE
  │    ├─ postLedger(-amount)  ← rejects overdraft
  │    ├─ INSERT order (status paid|review, delivery code)
  │    ├─ award points (40 per $1)
  │    └─ INSERT analytics event
  └─ COMMIT → 201 { order, wallet, risk }
```

### 2. Assistant streaming

```
POST /api/assistant/stream
  ├─ understand(message) → intent + entities + confidence
  ├─ snapshot(user)      → wallet, recent orders, month spend
  ├─ retrieval           → catalogue hits, recommender, KB snippets
  ├─ SSE: event: meta  { intent, products, suggestions, citations }
  ├─ SSE: event: token { text }  … (LLM tokens, or built-in word groups)
  └─ SSE: event: done  { text, engine }  → persist messages
```

## Model maths

**TF-IDF retrieval.** Tokenisation shingles Khmer runs (`កញ្ចប់` → chars, bigrams, trigrams) because the script has no word spaces; Latin tokens are stop-worded and lightly stemmed. Weight per token:

```
w(t,d) = (tf(t,d) / max_tf(d)) · (log((N + 1) / (df(t) + 1)) + 1)
score(q,d) = cosine(w(q), w(d))
```

final score blends `0.85 · cosine + 0.15 · popularity`, with bilingual synonym expansion before scoring.

**Recommendation.**
```
score = 0.34·content + 0.22·providerAffinity + 0.12·categoryAffinity
      + 0.10·priceFit + 0.14·popularity + 0.08·value + categoryBoost
providerAffinity(p) = Σ_orders 0.93^recencyIndex   (normalised)
priceFit = max(0, 1 − |ln(price / avgSpend)|)
```

**Risk model.** Seven features are clamped to [-1, 1] and combined:

```
z = −2.35 + Σ wᵢ·xᵢ
score = σ(z)  →  band: < 0.42 low · 0.42–0.72 review · ≥ 0.72 block
```
Weights: amount 1.9, velocity 1.4, provider/prefix mismatch 1.3, recipient novelty 1.1, account age 0.9, quantity 0.8, unusual hour 0.6. Contributions are surfaced to the user, so a block is always explainable.

**Forecasting.** Revenue is decomposed as `orders × average order value`: orders carry the volatile weekly rhythm while AOV drifts slowly, so multiplying two stable forecasts removes the spikes caused by single large bill payments (in the seeded dataset this cut revenue WAPE from ~48% to ~22%).

1. Additive Holt-Winters: `level`, `trend`, `seasonal[m]` with α=0.32, β=0.08, γ=0.28.
2. Drift-adjusted seasonal-naive baseline (repeat last week × momentum ratio, clamped 0.7–1.6).
3. Both are backtested on a true hold-out tail in original units, scored with **WAPE** (`Σ|error| / Σ|actual|`) — MAPE is unusable on retail series with near-zero days. Weights are inverse-error: `w = (1/E_hw)/((1/E_hw)+(1/E_naive))`.
4. The ensemble produces a point forecast plus an ~80% band `±1.28·σ√h`.

Two transforms are also benchmarked — identity and `log1p` — because revenue series are multiplicative; the backtest picks the better one, so the panel can report e.g. `Log-linear Holt-Winters 56% + seasonal-naive 44% (m=7)` with WAPE, baseline WAPE, blend weight and trend/day.

## Frontend architecture

- **State**: three small contexts — `LanguageProvider` (km/en dictionary), `AuthProvider` (JWT + wallet), `ToastProvider`. No global store library.
- **Data fetching**: `useAsync(loader, deps)` with cancellation + manual reload; `useDebounced` for search.
- **Streaming**: `streamChat()` reads the `fetch` body with a `TextDecoder`, splitting SSE frames — keeps `Authorization` headers (which `EventSource` cannot send).
- **Charts**: hand-written SVG (`ForecastChart`, `Sparkbars`, `BarList`, `RiskMeter`) — no chart dependency, fully themeable, responsive via `viewBox`.
- **Styling**: Tailwind v4 `@theme` tokens (`brand`, `aqua`, `gold`, `ink`), glassmorphism utilities, aurora background, custom keyframes, and reduced-motion fallbacks.

## Testing strategy

| Suite | Covers |
|---|---|
| `ai.test.ts` | tokenizer (incl. Khmer shingles), TF-IDF ranking, synonym expansion, 8 intent cases, entity extraction, forecast shape/bounds/baseline comparison, calendar densification |
| `api.test.ts` | health, validation errors, register/login/me, catalog filters + search, personalisation, order flow + idempotent replay, missing-funds 402, deposit fees, assistant JSON, SSE frames, admin RBAC, unauthorised access |

The API suite boots the real app against an in-memory database, so migrations, transactions and route wiring are exercised end to end.
