import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SCHEMA_SQL, POST_MIGRATION_SQL } from './schema.js';
import { log } from '../lib/logger.js';

export type Row = Record<string, unknown>;
type Param = string | number | null | bigint | Uint8Array;

function open(): DatabaseSync {
  if (config.dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  }
  const db = new DatabaseSync(config.dbPath);
  db.exec(SCHEMA_SQL);
  migrate(db);
  log.info('database ready', { path: config.dbPath });
  return db;
}

/** Additive migrations for databases created by earlier builds. */
function migrate(database: DatabaseSync) {
  const columns = database.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
  const hasIdempotency = columns.some((column) => column.name === 'idempotency_key');
  if (!hasIdempotency) {
    database.exec('ALTER TABLE orders ADD COLUMN idempotency_key TEXT');
    log.info('migration applied: orders.idempotency_key');
  }
  database.exec(POST_MIGRATION_SQL);
}

export const db = open();

/** Typed-ish helpers so routes stay readable. */
export const q = {
  all<T = Row>(sql: string, ...params: Param[]): T[] {
    return db.prepare(sql).all(...params) as T[];
  },
  get<T = Row>(sql: string, ...params: Param[]): T | undefined {
    return db.prepare(sql).get(...params) as T | undefined;
  },
  run(sql: string, ...params: Param[]) {
    return db.prepare(sql).run(...params);
  },
  exec(sql: string) {
    db.exec(sql);
  },
  transaction<T>(fn: () => T): T {
    return transaction(fn);
  },
};

let txDepth = 0;

/** Nest-safe transaction using savepoints for inner scopes. */
function transaction<T>(fn: () => T): T {
  const depth = txDepth;
  const savepoint = `sp_${depth}`;
  db.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
  txDepth += 1;
  try {
    const result = fn();
    txDepth -= 1;
    db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
    return result;
  } catch (error) {
    txDepth -= 1;
    try {
      db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
    } catch {
      // transaction already rolled back by SQLite
    }
    throw error;
  }
}

export function resetDatabase() {
  db.exec(`
    DELETE FROM messages; DELETE FROM conversations; DELETE FROM transactions;
    DELETE FROM orders; DELETE FROM events; DELETE FROM wallets;
    DELETE FROM products; DELETE FROM users;
  `);
}
