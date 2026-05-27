// Dashboard server — serves the 3 HTMLs + refresh button.
//
// Endpoints:
//   GET  /                   dashboard index page
//   GET  /healthz            liveness check (no DB roundtrip)
//   GET  /out/cohort.html
//   GET  /out/cohort_drilldown.html
//   GET  /roster/latest.html most recent data/roster-*.html
//   GET  /status             JSON: current/last run + stage staleness + cooldown
//   POST /refresh            kicks off pipeline (basic-auth required)
//
// Refresh contract:
//   - Hard 10-min cooldown after a successful run (override w/ ?force=1)
//   - Stages skip themselves when their output is fresh enough
//   - Returns 202 immediately with run_id; client polls /status
//   - Only one in-flight build at a time (409 otherwise)
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import * as refresh from './refresh.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3000', 10);
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
const DASHBOARD_USER = process.env.DASHBOARD_USER || 'kurio';

if (!DASHBOARD_PASSWORD) {
  console.warn('[server] DASHBOARD_PASSWORD not set — POST /refresh will reject all requests.');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// ------------ Basic auth gate for write endpoints ------------
function requireAuth(req, res, next) {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({ error: 'DASHBOARD_PASSWORD not configured on server' });
  }
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="kurio-dashboard"');
    return res.status(401).json({ error: 'auth required' });
  }
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user !== DASHBOARD_USER || pass !== DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'bad credentials' });
  }
  next();
}

// ------------ Routes ------------

app.get('/healthz', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.get('/', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(HERE, 'views', 'index.html'));
});

// Static-style HTML serving from DATA_DIR. We don't use express.static here
// because we want explicit no-cache + nice 404s pointing at /refresh.
async function sendDataFile(res, relPath, label) {
  const abs = path.join(refresh.DATA_DIR, relPath);
  try {
    await fs.access(abs);
  } catch {
    return res.status(404).type('html').send(
      `<h1>${label} not built yet</h1><p>Run a refresh to generate <code>${relPath}</code>.</p><p><a href="/">← back</a></p>`
    );
  }
  res.set('Cache-Control', 'no-store');
  res.sendFile(abs);
}

app.get('/out/cohort.html', (_req, res) => sendDataFile(res, 'out/cohort.html', 'Cohort chart'));
app.get('/out/cohort_drilldown.html', (_req, res) => sendDataFile(res, 'out/cohort_drilldown.html', 'Cohort drill-down'));

app.get('/roster/latest.html', async (_req, res) => {
  const p = await refresh.latestRosterPath();
  if (!p) {
    return res.status(404).type('html').send(
      `<h1>No roster built yet</h1><p>Run a refresh to generate the latest roster.</p><p><a href="/">← back</a></p>`
    );
  }
  res.set('Cache-Control', 'no-store');
  res.sendFile(p);
});

app.get('/status', async (_req, res) => {
  try {
    const [current, lastCompleted, lastSuccess, stages, cooldown, runs] = await Promise.all([
      db.currentRun(),
      db.lastCompletedRun(),
      db.lastSuccessRun(),
      refresh.stageStatuses(),
      refresh.cooldownStatus(),
      db.recentRuns(10),
    ]);
    const latestRoster = await refresh.latestRosterPath();
    res.json({
      now: new Date().toISOString(),
      data_dir: refresh.DATA_DIR,
      db_enabled: db.isDbEnabled(),
      cooldown_ms: refresh.COOLDOWN_MS,
      cooldown,
      current_run: current,
      last_completed_run: lastCompleted,
      last_success_run: lastSuccess,
      stages,
      latest_roster: latestRoster ? path.basename(latestRoster) : null,
      recent_runs: runs,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/refresh', requireAuth, async (req, res) => {
  const force = req.query.force === '1' || req.body?.force === true;
  // Single-flight: refuse if another build is in progress.
  const inFlight = await db.currentRun();
  if (inFlight) {
    return res.status(409).json({ error: 'a build is already running', run_id: inFlight.id });
  }
  if (!force) {
    const cool = await refresh.cooldownStatus();
    if (cool.remaining_ms > 0) {
      return res.status(429).json({
        error: 'cooldown active',
        remaining_ms: cool.remaining_ms,
        last_success_at: cool.last_success_at,
      });
    }
  }
  // Kick off in background; client polls /status.
  const triggeredBy = req.body?.triggered_by || 'manual';
  const promise = refresh.runRefresh({ force, triggeredBy });
  // Catch silently so unhandled-rejection doesn't kill the process; status
  // endpoint surfaces failure to the UI.
  promise.catch(e => console.error('[refresh] uncaught', e));
  res.status(202).json({ ok: true, started: true, force });
});

// ------------ Boot ------------
async function ensureDataDirs() {
  // Railway's persistent volume mounts shadow any subdirs created at image
  // build time, so we have to mkdir them on every boot. Local dev: idempotent.
  for (const sub of ['.cache', 'data', 'out']) {
    await fs.mkdir(path.join(refresh.DATA_DIR, sub), { recursive: true });
  }
}

async function main() {
  await ensureDataDirs();
  await db.init();
  app.listen(PORT, () => {
    console.log(`[server] listening on :${PORT}`);
    console.log(`[server] DATA_DIR=${refresh.DATA_DIR}`);
    console.log(`[server] db=${db.isDbEnabled() ? 'postgres' : 'memory'}  cooldown=${refresh.COOLDOWN_MS / 60_000}min`);
  });
}

main().catch(e => {
  console.error('[server] fatal:', e);
  process.exit(1);
});
