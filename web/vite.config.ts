import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const LOCAL_API = process.env.API_TARGET ?? 'http://127.0.0.1:8787';
const isVercel = Boolean(process.env.VERCEL);

/**
 * Local `npm run dev` proxies /api to the API process.
 * Under `vercel dev` (or any Vercel build) the platform router owns /api and
 * forwards it to the `api` service via the root vercel.json rewrite, so Vite
 * must NOT intercept it — otherwise requests bypass the service router.
 * Setting API_TARGET explicitly always enables the proxy (e.g. split deploys).
 */
const proxy = !isVercel || process.env.API_TARGET
  ? { '/api': { target: LOCAL_API, changeOrigin: true } }
  : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The Arena preview proxy serves this app from a generated hostname.
    allowedHosts: true,
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
