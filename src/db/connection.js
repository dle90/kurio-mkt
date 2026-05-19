import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The database file lives at the repo root as kurio.db (gitignored).
export const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '..', 'kurio.db');

let _db = null;

/** Shared singleton handle. Opens the db file on first call. */
export function db() {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA foreign_keys = ON;');
  }
  return _db;
}

export function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
