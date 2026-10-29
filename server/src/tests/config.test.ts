import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Keep the import free of filesystem side effects.
process.env.DATABASE_PATH = ':memory:';

const { resolveDatabasePath, isHostedRuntime } = await import('../config.js');

const env = (values: Record<string, string | undefined>) => values as NodeJS.ProcessEnv;

describe('runtime paths', () => {
  test('an explicit DATABASE_PATH always wins', () => {
    assert.equal(resolveDatabasePath(env({ DATABASE_PATH: '/data/custom.db' })), '/data/custom.db');
    assert.equal(
      resolveDatabasePath(env({ DATABASE_PATH: '/data/custom.db', VERCEL: '1' })),
      '/data/custom.db',
    );
  });

  test('Vercel uses the only writable directory (/tmp)', () => {
    assert.equal(resolveDatabasePath(env({ VERCEL: '1' })), '/tmp/nova.db');
  });

  test('Lambda without VERCEL also falls back to /tmp', () => {
    assert.equal(resolveDatabasePath(env({ AWS_LAMBDA_FUNCTION_NAME: 'fn' })), '/tmp/nova.db');
  });

  test('local development keeps the repo data directory', () => {
    assert.match(resolveDatabasePath(env({})), /data[/\\]nova\.db$/);
  });

  test('blank DATABASE_PATH is treated as unset', () => {
    assert.equal(resolveDatabasePath(env({ DATABASE_PATH: '   ', VERCEL: '1' })), '/tmp/nova.db');
  });

  test('hosted runtime detection', () => {
    assert.equal(isHostedRuntime(env({ VERCEL: '1' })), true);
    assert.equal(isHostedRuntime(env({ AWS_LAMBDA_FUNCTION_NAME: 'fn' })), true);
    assert.equal(isHostedRuntime(env({})), false);
  });
});
