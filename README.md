<div align="center">

# NOVA · AI Top-up Super App

**An AI-native top-up and digital-services platform for Cambodia.**
Full stack · TypeScript end to end · bilingual (ខ្មែរ / English) · zero paid AI dependency required.

`Express 5` · `SQLite (node:sqlite)` · `React 19` · `Vite 6` · `Tailwind v4` · `Zod`

</div>

---

## សេចក្តីសង្ខេប (Khmer)

**NOVA** គឺជាកម្មវិធី full-stack ដែលអនុញ្ញាតឱ្យអ្នកបញ្ចូលលុយទូរស័ព្ទ ទិញកញ្ចប់អ៊ីនធឺណិត ហ្គេម បង់វិក្កយបត្រ និងទិញ eSIM — ទាំងអស់ក្នុងកន្លែងតែមួយ។
ចំណុចពិសេសគឺ **ជំនួយការ AI ពីរភាសា** ដែលឆ្លើយដោយផ្អែកលើទិន្នន័យពិត (ផលិតផល តម្លៃ កាបូប ប្រវត្តិបញ្ជាទិញ) មិនមែនការទាយធម្មតាទេ។
ប្រព័ន្ធមាន **ការវាយតម្លៃហានិភ័យដែលអាចពន្យល់បាន** សម្រាប់រាល់ប្រតិបត្តិការ និង **ការព្យាករណ៍តម្រូវការ** សម្រាប់អ្នកគ្រប់គ្រង។

```bash
npm install && npm run seed && npm run dev
# → API http://localhost:8787  ·  Web http://localhost:5173
# Demo: demo@nova.ai / Demo@1234   ·   Admin: admin@nova.ai / Admin@123
```

---

## Why this is an "AI application", not a store with a chatbot

| Capability | Implementation | Where |
|---|---|---|
| **Bilingual NLU** | Intent classifier over 12 bilingual intents + entity extraction (provider, amount, GB, phone, urgency) with calibrated confidence | `server/src/ai/nlu.ts` |
| **Khmer-aware retrieval** | Unsegmented Khmer is shingled into uni/bi/trigrams, Latin words are stemmed, then scored with TF‑IDF + cosine. Ships a bilingual synonym bridge (អ៊ីនធឺណិត → internet, data…) | `server/src/ai/text.ts` |
| **Grounded generation** | Every answer is composed from live catalogue rows, wallet ledger and order history. Optional upstream LLM receives the same retrieval context (RAG) — never ungrounded | `server/src/ai/assistant.ts`, `llm.ts` |
| **Streaming** | Real SSE token stream (`event: meta → token → done`) consumed by a custom `fetch` reader, so auth headers still work | `server/src/routes/assistant.ts`, `web/src/lib/api.ts` |
| **Hybrid recommender** | Content similarity + provider/category affinity with exponential recency decay + price-fit + popularity prior, plus co-purchase lift ("also bought") | `server/src/ai/recommend.ts` |
| **Explainable fraud model** | Calibrated logistic model over 7 behavioural features; every contribution is exposed and human-readable in both languages | `server/src/ai/risk.ts` |
| **Demand forecasting** | Additive Holt‑Winters (α/β/γ) ensembled with a drift-adjusted seasonal-naive baseline, weighted by true out-of-sample MAPE on a hold-out window | `server/src/ai/forecast.ts` |
| **Proactive insights** | Month-over-month spend trend, purchase-cadence prediction (median interval), value-swap detection, points and runway nudges | `server/src/ai/insights.ts` |
| **Knowledge retrieval** | Bilingual help-centre with query-relevant sentence extraction used as citations in answers | `server/src/ai/knowledge.ts` |

> No API key required. If you set `AI_BASE_URL` + `AI_API_KEY`, the assistant transparently upgrades to any OpenAI-compatible model and keeps all tooling/grounding.

---

## Feature tour

**Customer**
- Landing page with live AI console preview, category grid, personalised picks and AI insights
- Shop with semantic search, category/provider filters, sort by price/value/popularity
- Checkout drawer with live risk assessment, bulk discounts (3–6%), idempotent payments, delivery codes
- Streaming AI concierge with conversation history, product cards, actions and citations
- Wallet: deposits via ABA/ACLEDA/Bakong/Wing/card (fee handling), points redemption, ledger
- Orders: delivery codes, risk meter, channel attribution

**Admin**
- Revenue / GMV / AOV / review-queue metrics, 45-day revenue series
- Forecast chart with confidence band, model name, MAPE vs baseline, trend/day
- Risk queue with approve / reject-and-refund actions
- Top products by revenue, top customers, assistant intent mix and latency

**Platform**
- scrypt password hashing, HS256 JWT sessions, role-based access, per-route rate limiting
- Money as integer cents, nest-safe SQLite transactions (savepoints), idempotency keys
- Zod-validated request bodies with field-level error details
- 32 automated tests (unit + full API integration incl. SSE)

---

## Quick start

```bash
# 1. install (Node ≥ 22.5 — uses the built-in node:sqlite driver)
npm install

# 2. seed the demo world (36 products, 10 users, ~390 orders across 45 days)
npm run seed

# 3. run API + web together
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to `http://127.0.0.1:8787`.

### Demo accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| Customer | `demo@nova.ai` | `Demo@1234` | 51 orders of history, $42.50 wallet, 438 points |
| Admin | `admin@nova.ai` | `Admin@123` | Full analytics console |
| New signup | — | — | `$50` welcome credit in demo mode |

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | API (:8787) + Vite (:5173) with prefixed logs |
| `npm run dev:server` / `npm run dev:web` | Run one side only |
| `npm run seed` | Rebuild the demo database (destructive) |
| `npm test` | 32 tests: tokenizer, NLU, forecasting, API + SSE |
| `npm run typecheck` | Strict TypeScript across server and web |
| `npm run build` | Compile server (`tsc`) + bundle web (`vite build`) |
| `npm start` | Serve the built SPA and API from one process (:8787) |

---

## Deployment

**Single service (recommended).** `npm run build && npm start` — Express serves `web/dist` with SPA fallback, so one process on one port serves the whole app.

**Docker.**
```bash
docker build -t nova .
docker run -p 8787:8787 -e JWT_SECRET="$(openssl rand -hex 32)" nova
```

**Environment** — copy `.env.example` to `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `8787` / `0.0.0.0` | API bind address |
| `DATABASE_PATH` | `./data/nova.db` | SQLite file (`:memory:` for tests) |
| `JWT_SECRET` | dev fallback | **Set in production** — signs session tokens |
| `CORS_ORIGINS` | `*` | Comma-separated allowlist |
| `RATE_MAX` / `ASSISTANT_RATE_MAX` | `240` / `40` per minute | Rate limiting |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | unset | Upgrade to a hosted LLM |
| `DEMO_MODE` | `true` | Welcome credit + demo affordances |

CI (`.github/workflows/ci.yml`) runs typecheck → tests → build → packaged smoke test on every push.

---

## Project structure

```
.
├── server/                       # Express 5 API + AI engine
│   └── src/
│       ├── ai/                   # nlu · text · catalog · recommend · risk · forecast · insights · assistant · llm · knowledge
│       ├── db/                   # schema, migrations, connection, seed world
│       ├── lib/                  # jwt, password (scrypt), payments ledger, http helpers, ids, logger
│       ├── middleware/           # auth (JWT), rate limiting
│       ├── routes/               # auth · products · assistant · wallet · orders · admin · help · insights
│       └── tests/                # ai.test.ts · api.test.ts
├── web/                          # React 19 + Vite + Tailwind v4
│   └── src/
│       ├── components/           # Layout · ProductCard · Checkout · Charts · ui primitives
│       ├── lib/                  # api client (incl. SSE), auth, i18n (km/en), format, hooks, toast
│       └── pages/                # Home · Shop · Assistant · Wallet · Orders · Admin · Help · Auth
├── scripts/dev.mjs               # dev orchestrator
├── docs/ARCHITECTURE.md          # data model, request flows, AI maths
└── docs/API.md                   # endpoint reference
```

## API at a glance

```
POST   /api/auth/register · /login          GET /api/auth/me
GET    /api/products?category&provider&q&sort  GET /api/products/recommendations
POST   /api/assistant/chat                  POST /api/assistant/stream   (SSE)
GET    /api/assistant/conversations[/:id]   DELETE /api/assistant/conversations/:id
GET    /api/wallet · /transactions          POST /api/wallet/deposit · /redeem-points
POST   /api/orders · /orders/preview        GET  /api/orders[/:reference]
GET    /api/admin/metrics · /forecast · /top-products · /risk-queue · /customers · /assistant-stats
GET    /api/insights · /api/help/articles   GET  /api/health
```

Full reference with payloads: [`docs/API.md`](docs/API.md). Architecture and model maths: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Design notes

- **Money** is stored and transported as integer cents; formatting happens only in the UI.
- **Khmer typography** uses Kantumruy Pro with a Noto fallback; the assistant renders Khmer, emoji and markdown bullets without breaking line-height.
- **Accessibility**: keyboard focus rings, ARIA labels on icon buttons, Escape-closes modals, `prefers-reduced-motion` support.
- **Security**: no secrets in the client, scrypt hashes, JWT with expiry, request validation, per-route rate limits, and fraud blocked server-side (never trusted to the client).

<div align="center">

Built end-to-end with AI pair-programming · NOVA © 2026

</div>
