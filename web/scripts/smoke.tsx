/**
 * Render smoke test — mounts every route server-side with the real providers.
 * Catches import-time and render-time regressions without a browser.
 *   npm run smoke
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const store = new Map<string, string>();
const g = globalThis as any;
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
g.document = { documentElement: { lang: 'km' } };
g.window = { setTimeout: setTimeout, clearTimeout: clearTimeout, matchMedia: () => ({ matches: false }) };
Object.defineProperty(g, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
g.fetch = async () => new Response(JSON.stringify({ items: [], insights: [], conversations: [], categories: [], providers: [], total: 0 }), { headers: { 'content-type': 'application/json' } });

const ReactLib = await import('react');
const { renderToString } = await import('react-dom/server');
const { MemoryRouter } = await import('react-router-dom');
const { LanguageProvider } = await import('../src/lib/i18n');
const { AuthProvider } = await import('../src/lib/auth');
const { ToastProvider } = await import('../src/lib/toast');
const { default: App } = await import('../src/App');

const routes = ['/', '/shop', '/assistant', '/wallet', '/orders', '/admin', '/help', '/auth'];
for (const route of routes) {
  const html = renderToString(
    ReactLib.createElement(
      MemoryRouter,
      { initialEntries: [route] },
      ReactLib.createElement(
        LanguageProvider,
        null,
        ReactLib.createElement(AuthProvider, null, ReactLib.createElement(ToastProvider, null, ReactLib.createElement(App))),
      ),
    ),
  );
  console.log(`✓ ${route.padEnd(11)} rendered ${html.length} chars`);
}

export {};
