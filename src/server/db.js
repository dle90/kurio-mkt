// Postgres for build-run tracking + cooldown state.
// Schema is created idempotently on startup — no separate migration step.
// Locally: set DATABASE_URL to a local Postgres (or skip and the server
// will run in NO_DB mode, which keeps cooldown state in-memory only).
import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let dbEnabled = false;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway') || DATABASE_URL.includes('amazonaws')
      ? { rejectUnauthorized: false }
      : false,
  });
  dbEnabled = true;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS build_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  stages_ran JSONB,
  log TEXT,
  triggered_by TEXT
);
CREATE INDEX IF NOT EXISTS build_runs_started_at_idx ON build_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS build_runs_status_idx ON build_runs (status);
`;

// In-memory fallback when DB is not configured. Lost on restart.
const mem = { runs: [], nextId: 1 };

export async function init() {
  if (!dbEnabled) {
    console.log('[db] DATABASE_URL not set — using in-memory state (cooldown will reset on restart)');
    return;
  }
  await pool.query(SCHEMA);
  // Any 'running' rows from a prior process crashed mid-build. Mark as error
  // so the cooldown gate isn't blocked forever.
  const r = await pool.query(
    `UPDATE build_runs SET status = 'error', finished_at = NOW(),
       log = COALESCE(log, '') || E'\n[server restart: marked as error]'
     WHERE status = 'running' RETURNING id`
  );
  if (r.rowCount) console.log(`[db] reclaimed ${r.rowCount} stale 'running' row(s) on startup`);
  console.log('[db] schema ready');
}

export async function startRun(triggeredBy) {
  if (!dbEnabled) {
    const row = { id: mem.nextId++, started_at: new Date(), finished_at: null, status: 'running', stages_ran: null, log: '', triggered_by: triggeredBy };
    mem.runs.unshift(row);
    return row;
  }
  const r = await pool.query(
    `INSERT INTO build_runs (status, triggered_by) VALUES ('running', $1)
     RETURNING id, started_at, status, triggered_by`,
    [triggeredBy]
  );
  return r.rows[0];
}

export async function finishRun(id, { status, stagesRan, log }) {
  if (!dbEnabled) {
    const row = mem.runs.find(r => r.id === id);
    if (row) { row.status = status; row.stages_ran = stagesRan; row.log = log; row.finished_at = new Date(); }
    return;
  }
  await pool.query(
    `UPDATE build_runs SET status = $2, stages_ran = $3, log = $4, finished_at = NOW() WHERE id = $1`,
    [id, status, stagesRan ? JSON.stringify(stagesRan) : null, log || null]
  );
}

export async function appendLog(id, chunk) {
  if (!dbEnabled) {
    const row = mem.runs.find(r => r.id === id);
    if (row) row.log = (row.log || '') + chunk;
    return;
  }
  await pool.query(
    `UPDATE build_runs SET log = COALESCE(log, '') || $2 WHERE id = $1`,
    [id, chunk]
  );
}

// Return the currently-running build (if any).
export async function currentRun() {
  if (!dbEnabled) return mem.runs.find(r => r.status === 'running') || null;
  const r = await pool.query(
    `SELECT id, started_at, status, triggered_by FROM build_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1`
  );
  return r.rows[0] || null;
}

// Return the most recent completed (success or error) run.
export async function lastCompletedRun() {
  if (!dbEnabled) return mem.runs.find(r => r.status !== 'running') || null;
  const r = await pool.query(
    `SELECT id, started_at, finished_at, status, stages_ran, triggered_by
     FROM build_runs WHERE status <> 'running' ORDER BY id DESC LIMIT 1`
  );
  return r.rows[0] || null;
}

// Most recent successful run — drives the cooldown gate.
export async function lastSuccessRun() {
  if (!dbEnabled) return mem.runs.find(r => r.status === 'success') || null;
  const r = await pool.query(
    `SELECT id, started_at, finished_at, stages_ran
     FROM build_runs WHERE status = 'success' ORDER BY id DESC LIMIT 1`
  );
  return r.rows[0] || null;
}

export async function recentRuns(limit = 10) {
  if (!dbEnabled) return mem.runs.slice(0, limit);
  const r = await pool.query(
    `SELECT id, started_at, finished_at, status, stages_ran, triggered_by
     FROM build_runs ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return r.rows;
}

export function isDbEnabled() { return dbEnabled; }
