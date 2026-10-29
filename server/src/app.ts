import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { config, hasExternalLLM } from './config.js';
import { errorHandler, notFoundHandler } from './lib/http.js';
import { rateLimit } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { assistantRouter } from './routes/assistant.js';
import { walletRouter } from './routes/wallet.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin.js';
import { helpRouter } from './routes/help.js';
import { insightsRouter } from './routes/insights.js';
import { refreshCatalogIndex } from './ai/catalog.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(rateLimit(config.limits.rateMaxRequests, config.limits.rateWindowMs));

  refreshCatalogIndex();

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'nova-topup-ai',
      version: '1.0.0',
      time: new Date().toISOString(),
      ai: {
        engine: hasExternalLLM() ? 'external-llm' : 'nova-builtin',
        model: hasExternalLLM() ? config.ai.model : 'nova-retrieval-v1',
        demoMode: config.features.demoMode,
      },
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/help', helpRouter);
  app.use('/api/insights', insightsRouter);

  // Serve the built SPA when it exists (single-service production deploy).
  const webDist = path.resolve(config.rootDir, 'web', 'dist');
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
