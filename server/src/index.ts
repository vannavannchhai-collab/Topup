import { createApp } from './app.js';
import { config, hasExternalLLM } from './config.js';
import { log } from './lib/logger.js';
import { q } from './db/index.js';
import { ensureSeed } from './db/seed.js';

const productCount = q.get<{ count: number }>('SELECT COUNT(*) AS count FROM products')?.count ?? 0;
if (productCount === 0) {
  log.info('empty catalog detected — seeding demo data');
  await ensureSeed();
}

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  log.info(`NOVA API listening on http://${config.host}:${config.port}`, {
    env: config.env,
    ai: hasExternalLLM() ? `external:${config.ai.model}` : 'nova-builtin',
  });
});

const shutdown = (signal: string) => {
  log.info(`received ${signal}, closing server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
