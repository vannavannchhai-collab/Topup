# Deploying NOVA on Vercel (multi-service)

This repository ships a root [`vercel.json`](../vercel.json) that deploys **two services in one project**:

```
                    ┌──────────────────────────────┐
   Browser  ──────► │  Vercel project (one domain)  │
                    │                              │
   /api/*  ────────►│  api   (container, Express)   │  server/Dockerfile → :$PORT
   /*      ────────►│  web   (static, Vite SPA)     │  web/dist → CDN + SPA fallback
                    └──────────────────────────────┘
```

| Service | Root | Kind | Public path | Why |
|---|---|---|---|---|
| `web` | `web/` | `framework: "vite"` | `/` (catch-all) | Static SPA; React Router handles client routes |
| `api` | `server/` | `runtime: "container"` | `/api/*` | Needs Node 22 with `--experimental-sqlite`, a writable `/tmp`, and a long-lived process |

Both services stay **independently buildable** (`web` → `vite build`, `api` → `tsc` + container image), and only `web` and `/api/*` are exposed publicly. Everything else in the repo (`docs/`, `.github/`) is not a service.

## Final `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "web": { "root": "web", "framework": "vite" },
    "api": { "root": "server", "runtime": "container" }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "api" } },
    { "source": "/(.*)", "destination": { "service": "web" } }
  ]
}
```

Order matters: the specific `/api/(.*)` rule comes first, the catch-all last.

## Why there are no `bindings`

Bindings inject one service's **internal URL** into another service's runtime env. NOVA has no server→server calls, so there is nothing to bind:

- The browser calls the API through the **public** rewrite `/api/(.*)` with relative URLs (`web/src/lib/api.ts` → `/api`), so the SPA needs no API hostname at build or run time.
- The API never calls the web service. It serves JSON only — in hosted mode `config.hosted` disables Express's SPA fallback (`server/src/app.ts`), so `api` answers `/api/*` and nothing else.
- The only outbound call the API can make is the **optional** upstream LLM (`AI_BASE_URL`), which is a plain env var, not a service.

If a future change introduces server-side rendering or an authenticated backend-for-frontend, add the binding on the *calling* service, e.g.:

```json
"web": {
  "root": "web",
  "framework": "vite",
  "bindings": [{ "type": "service", "service": "api", "format": "url", "env": "API_INTERNAL_URL" }]
}
```
…and read `process.env.API_INTERNAL_URL` in that service's server-side code only (bindings resolve at runtime, never during builds).

## Environment variables

Set these in **Project → Settings → Environment Variables** (they are shared by every service):

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | **yes** | `openssl rand -hex 32`. Without it sessions use the dev fallback. |
| `DEMO_MODE` | no | Default `true` — gives new signups $50 welcome credit. Set `false` for a production storefront. |
| `CORS_ORIGINS` | no | Default `*`. Set to your domain once live. |
| `DATABASE_PATH` | no | Defaults to `/tmp/nova.db` automatically when `VERCEL` is present (see below). |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | no | Upgrade the assistant to a hosted OpenAI-compatible model. |
| `VITE_API_BASE` | no | Only for a split deployment where the API lives on another origin. Leave empty. |

`PORT` is injected by Vercel; the API reads it (`server/src/config.ts`). Do **not** set it.

## Storage caveat (important)

The API uses SQLite via `node:sqlite`. Vercel's filesystem is **ephemeral and per-instance**, so:

- `resolveDatabasePath()` writes to **`/tmp/nova.db`** on Vercel instead of `<repo>/data/nova.db` (the repo mount is read-only and would throw at boot).
- On a cold start with an empty database the API **auto-seeds** the demo catalog (36 products, ~650 orders) in about a second, so the deployed preview is immediately usable.
- Data written by a user survives only as long as that instance (and never reaches other instances or a redeploy).

That is fine for demos and previews. For a real storefront, point the data layer at a hosted database (Neon/Supabase Postgres, Turso/libSQL, Upstash). The data access is isolated in `server/src/db/index.ts` (`q.all/get/run/transaction`), so swapping the driver does not touch route or AI code.

## Preview deploys & local testing

```bash
# Whole project (both services) behind Vercel's router, with the /api rewrite live:
npm i -g vercel && vercel dev

# Classic local stack (unchanged): Vite proxies /api to 127.0.0.1:8787
npm run seed && npm run dev
```

Vite's dev proxy is automatically **disabled when `VERCEL` is set**, so `/api` reaches the platform router instead of a hardcoded `127.0.0.1:8787` (`web/vite.config.ts`). Override with `API_TARGET=…` if you deliberately want the proxy.

Post-deploy smoke test:

```bash
curl -s https://<your-app>.vercel.app/api/health          # {"status":"ok", ...}
curl -s -o /dev/null -w '%{http_code}\n' https://<your-app>.vercel.app/assistant   # 200 (SPA fallback)
curl -s -X POST https://<your-app>.vercel.app/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@nova.ai","password":"Demo@1234"}'   # {"token": ...}
```

## Alternative: run the API as an Express framework service

If you prefer the platform's Express preset over a container (smaller cold starts, managed runtime), swap the `api` service and make sure the start command keeps the `--experimental-sqlite` flag — it is already part of `server/package.json`'s `start` script:

```json
"api": { "root": "server", "framework": "express" }
```

Verify with `vercel dev` that `/api/health` responds; if the preset does not pick up `npm start`, add per-service `buildCommand`/`start` overrides or set `NODE_OPTIONS=--experimental-sqlite` and remove the flag from the script.
