import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const { createApp } = await import('../app.js');
const { seedAll } = await import('../db/seed.js');

const app = createApp();
let server: ReturnType<typeof app.listen>;
let baseUrl = '';

before(async () => {
  await seedAll({ destructive: true });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

async function api(path: string, options: RequestInit & { token?: string } = {}) {
  const { token, ...init } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

describe('NOVA API', () => {
  test('health reports the AI engine', async () => {
    const { status, body } = await api('/api/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.ok(['nova-builtin', 'external-llm'].includes(body.ai.engine));
  });

  test('rejects weak registrations with field details', async () => {
    const { status, body } = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: 'short', name: 'A' }),
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, 'bad_request');
    assert.ok(body.error.details.issues.length >= 3);
  });

  test('register → login → me round trip', async () => {
    const registered = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'new.user@example.com',
        password: 'SuperSecret123',
        name: 'New User',
        locale: 'en',
        demoFunds: true,
      }),
    });
    assert.equal(registered.status, 201);
    assert.ok(registered.body.token);

    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'new.user@example.com', password: 'SuperSecret123' }),
    });
    assert.equal(login.status, 200);

    const me = await api('/api/auth/me', { token: login.body.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'new.user@example.com');
    assert.equal(me.body.user.wallet.balanceCents, 5000);
  });

  test('wrong password is a 401', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@nova.ai', password: 'WrongPassword1' }),
    });
    assert.equal(status, 401);
  });

  test('catalog supports category filters and semantic search', async () => {
    const all = await api('/api/products?category=data');
    assert.equal(all.status, 200);
    assert.ok(all.body.items.length > 0);
    assert.ok(all.body.items.every((item: any) => item.category === 'data'));

    const searched = await api('/api/products?q=mobile%20legends');
    assert.ok(searched.body.items.some((item: any) => item.sku.startsWith('mlbb')));
  });

  test('recommendations are personalised for signed-in customers', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@nova.ai', password: 'Demo@1234' }),
    });
    const recs = await api('/api/products/recommendations?limit=4', { token: login.body.token });
    assert.equal(recs.status, 200);
    assert.equal(recs.body.personalized, true);
    assert.equal(recs.body.items.length, 4);
    assert.ok(recs.body.items[0].reasonsEn.length > 0);
  });

  test('order flow debits the wallet and is idempotent', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@nova.ai', password: 'Demo@1234' }),
    });
    const token = login.body.token;
    const before = login.body.user.wallet.balanceCents;

    const products = await api('/api/products?category=data');
    const product = products.body.items[0];

    const first = await api('/api/orders', {
      method: 'POST',
      token,
      body: JSON.stringify({ productId: product.id, recipient: '012345678', idempotencyKey: 'test-idem-key-1' }),
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.order.status === 'paid' || first.body.order.status === 'review', true);
    const balanceAfter = first.body.wallet.balanceCents;
    assert.equal(balanceAfter, before - first.body.order.amountCents);

    const replay = await api('/api/orders', {
      method: 'POST',
      token,
      body: JSON.stringify({ productId: product.id, recipient: '012345678', idempotencyKey: 'test-idem-key-1' }),
    });
    assert.equal(replay.body.replayed, true);
    assert.equal(replay.body.order.reference, first.body.order.reference);
  });

  test('orders reject invalid recipients before charging', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@nova.ai', password: 'Demo@1234' }),
    });
    const products = await api('/api/products?category=data');
    const { status, body } = await api('/api/orders', {
      method: 'POST',
      token: login.body.token,
      body: JSON.stringify({ productId: products.body.items[0].id, recipient: '123' }),
    });
    assert.equal(status, 400);
    assert.equal(body.error.code, 'bad_request');
  });

  test('insufficient funds returns 402 with the shortfall', async () => {
    const registered = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'broke@example.com', password: 'SuperSecret123', name: 'Broke User' }),
    });
    const products = await api('/api/products?category=mobile');
    const { status, body } = await api('/api/orders', {
      method: 'POST',
      token: registered.body.token,
      body: JSON.stringify({ productId: products.body.items.at(-1).id, recipient: '012345678' }),
    });
    assert.equal(status, 402);
    assert.equal(body.error.code, 'insufficient_funds');
    assert.ok(body.error.details.requiredCents > 0);
  });

  test('wallet deposit applies the method fee', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@nova.ai', password: 'Demo@1234' }),
    });
    const { status, body } = await api('/api/wallet/deposit', {
      method: 'POST',
      token: login.body.token,
      body: JSON.stringify({ amountCents: 2000, method: 'wing' }),
    });
    assert.equal(status, 201);
    assert.equal(body.creditedCents, 1900);
    assert.equal(body.feeCents, 100);
  });

  test('assistant answers with grounded product picks', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@nova.ai', password: 'Demo@1234' }),
    });
    const { status, body } = await api('/api/assistant/chat', {
      method: 'POST',
      token: login.body.token,
      body: JSON.stringify({ message: 'I need cheap internet for a week', locale: 'en' }),
    });
    assert.equal(status, 200);
    assert.ok(body.text.length > 40);
    assert.ok(body.products.length > 0);
    assert.ok(body.conversationId);
    assert.ok(body.confidence > 0.3);
  });

  test('assistant streams SSE tokens', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@nova.ai', password: 'Demo@1234' }),
    });
    const response = await fetch(`${baseUrl}/api/assistant/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${login.body.token}` },
      body: JSON.stringify({ message: 'សមតុល្យរបស់ខ្ញុំ', locale: 'km' }),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    const payload = await response.text();
    assert.match(payload, /event: meta/);
    assert.match(payload, /event: token/);
    assert.match(payload, /event: done/);
  });

  test('admin endpoints require the admin role', async () => {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@nova.ai', password: 'Demo@1234' }),
    });
    const denied = await api('/api/admin/metrics', { token: login.body.token });
    assert.equal(denied.status, 403);

    const admin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@nova.ai', password: 'Admin@123' }),
    });
    const allowed = await api('/api/admin/metrics', { token: admin.body.token });
    assert.equal(allowed.status, 200);
    assert.ok(allowed.body.orderCount > 0);

    const forecast = await api('/api/admin/forecast', { token: admin.body.token });
    assert.equal(forecast.status, 200);
    assert.equal(forecast.body.orders.forecast.length, 7);
  });

  test('protected routes require a token', async () => {
    const { status, body } = await api('/api/orders');
    assert.equal(status, 401);
    assert.equal(body.error.code, 'unauthorized');
  });
});
