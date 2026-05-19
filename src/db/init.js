import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db, DB_PATH, close } from './connection.js';

// Applies schema.sql. Idempotent — safe to re-run; CREATE ... IF NOT EXISTS
// preserves existing data, and views are dropped + recreated.
const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

const conn = db();
conn.exec(schema);

const tables = conn
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map(r => r.name);
const views = conn
  .prepare("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
  .all()
  .map(r => r.name);

console.log(`Schema applied to ${DB_PATH}`);
console.log(`  tables: ${tables.join(', ')}`);
console.log(`  views:  ${views.join(', ')}`);
close();
