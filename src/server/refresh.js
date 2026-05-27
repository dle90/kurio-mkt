// Refresh pipeline orchestration.
//
// Each stage has an output file we check the mtime of. If younger than its
// staleness threshold, the stage is skipped — that's the "incremental update"
// guarantee. A force=true override re-runs every stage regardless.
//
// Stages run sequentially in order — dependencies between them (roster reads
// the drilldown's code-roas-window.json, cohort_chart reads the roster JSON)
// require this ordering. Don't parallelize without rethinking those reads.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const DATA_DIR = path.resolve(process.env.DATA_DIR || REPO_ROOT);

const HOUR = 3_600_000;
const MIN = 60_000;

// Staleness thresholds — if the output file is younger than this, skip the stage.
// Tune these here, not inline. All values in ms.
//
// dependsOn: when any listed stage ran in this build, this stage also runs.
// That's how downstream HTMLs pick up a fresh upstream cache even when their
// own output file looks fresh by mtime alone.
export const STAGES = [
  {
    name: 'meta_spend_monthly',
    label: 'Meta spend monthly (campaign→code map)',
    script: 'src/roas/fetch_meta_spend_monthly.js',
    outFile: '.cache/meta_spend_monthly.json',
    maxAgeMs: 24 * HOUR,
  },
  {
    name: 'getfly_orders',
    label: 'Getfly orders (YTD)',
    script: 'src/roas/fetch_getfly_orders_ytd.js',
    outFile: '.cache/getfly_orders_ytd.json',
    maxAgeMs: 1 * HOUR,
  },
  {
    name: 'getfly_accounts',
    label: 'Getfly accounts',
    script: 'src/roas/fetch_getfly_accounts.js',
    outFile: '.cache/getfly_accounts.json',
    maxAgeMs: 6 * HOUR,
  },
  {
    name: 'cohort_drilldown',
    label: 'Cohort drill-down (writes code-roas-window.json)',
    script: 'src/dashboard/cohort_drilldown.js',
    outFile: 'out/cohort_drilldown.html',
    maxAgeMs: 10 * MIN,
    dependsOn: ['meta_spend_monthly', 'getfly_orders', 'getfly_accounts'],
  },
  {
    name: 'adset_roster',
    label: 'Ad-set roster',
    script: 'src/reports/adset_roster.js',
    // Roster writes data/roster-{YDAY}.{md,html,json}. YDAY = today - 1 (UTC).
    outFile: () => `data/roster-${yesterday()}.json`,
    maxAgeMs: 10 * MIN,
    dependsOn: ['cohort_drilldown', 'getfly_accounts'],
  },
  {
    name: 'cohort_chart',
    label: 'Cohort chart (out/cohort.html — embeds latest roster)',
    script: 'src/dashboard/cohort_chart.js',
    outFile: 'out/cohort.html',
    maxAgeMs: 10 * MIN,
    dependsOn: ['adset_roster', 'getfly_orders', 'getfly_accounts'],
  },
];

// Cooldown: how long after the last *successful* refresh until POST /refresh
// will run anything new. Force=true bypasses this.
export const COOLDOWN_MS = 10 * MIN;

function yesterday() {
  const t = Date.now() - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

async function fileMtime(relPath) {
  try {
    const st = await fs.stat(path.join(DATA_DIR, relPath));
    return st.mtimeMs;
  } catch {
    return null;
  }
}

// Returns ms-age of the stage's output file, or Infinity if missing.
async function stageAgeMs(stage) {
  const rel = typeof stage.outFile === 'function' ? stage.outFile() : stage.outFile;
  const mtime = await fileMtime(rel);
  return mtime == null ? Infinity : Date.now() - mtime;
}

// Get per-stage staleness snapshot (used by GET /status).
export async function stageStatuses() {
  const out = [];
  for (const stage of STAGES) {
    const rel = typeof stage.outFile === 'function' ? stage.outFile() : stage.outFile;
    const ageMs = await stageAgeMs(stage);
    out.push({
      name: stage.name,
      label: stage.label,
      out_file: rel,
      age_ms: isFinite(ageMs) ? ageMs : null,
      stale: ageMs >= stage.maxAgeMs,
      max_age_ms: stage.maxAgeMs,
    });
  }
  return out;
}

// Get cooldown info — ms remaining until POST /refresh accepts a new build.
export async function cooldownStatus() {
  const last = await db.lastSuccessRun();
  if (!last || !last.finished_at) return { remaining_ms: 0, last_success_at: null };
  const elapsed = Date.now() - new Date(last.finished_at).getTime();
  return {
    remaining_ms: Math.max(0, COOLDOWN_MS - elapsed),
    last_success_at: last.finished_at,
  };
}

// Spawn a child node process, capturing stdout/stderr.
// cwd = DATA_DIR so the script's relative paths (`.cache/...`, `data/...`,
// `out/...`) resolve under the persistent volume.
function runScript(scriptRel, onChunk) {
  return new Promise((resolve, reject) => {
    const scriptAbs = path.join(REPO_ROOT, scriptRel);
    const proc = spawn(process.execPath, [scriptAbs], {
      cwd: DATA_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const onData = label => chunk => {
      const text = chunk.toString();
      out += text;
      onChunk?.(`[${label}] ${text}`);
    };
    proc.stdout.on('data', onData('stdout'));
    proc.stderr.on('data', onData('stderr'));
    proc.on('error', reject);
    proc.on('exit', code => {
      if (code === 0) resolve(out);
      else reject(new Error(`${scriptRel} exited with code ${code}\n${out.slice(-2000)}`));
    });
  });
}

// Plan which stages to run for this refresh, given the current state.
export async function planRun({ force = false } = {}) {
  const plan = [];
  const ranThisBuild = new Set();
  for (const stage of STAGES) {
    let shouldRun = force;
    if (!shouldRun) {
      const ageMs = await stageAgeMs(stage);
      if (ageMs >= stage.maxAgeMs) shouldRun = true;
    }
    // Chained dependency: if any listed upstream ran in this build, this one
    // must too — its inputs are fresher than its output's mtime suggests.
    if (!shouldRun && stage.dependsOn) {
      const deps = Array.isArray(stage.dependsOn) ? stage.dependsOn : [stage.dependsOn];
      if (deps.some(d => ranThisBuild.has(d))) shouldRun = true;
    }
    plan.push({ stage, shouldRun });
    if (shouldRun) ranThisBuild.add(stage.name);
  }
  return plan;
}

// Run the pipeline. Records a build_runs row. Async — caller polls /status.
export async function runRefresh({ force = false, triggeredBy = 'manual', onLog } = {}) {
  const run = await db.startRun(triggeredBy);
  const stagesRan = [];
  const log = [];
  const collect = chunk => {
    log.push(chunk);
    onLog?.(chunk);
    // Async-fire DB append; ignore failure
    db.appendLog(run.id, chunk).catch(() => {});
  };
  collect(`[plan] DATA_DIR=${DATA_DIR}\n`);
  try {
    const plan = await planRun({ force });
    for (const { stage, shouldRun } of plan) {
      if (!shouldRun) {
        const ageMs = await stageAgeMs(stage);
        const ageMin = isFinite(ageMs) ? (ageMs / 60_000).toFixed(1) : '∞';
        collect(`[skip]  ${stage.name} — output ${ageMin}min old < ${(stage.maxAgeMs / 60_000).toFixed(0)}min threshold\n`);
        stagesRan.push({ name: stage.name, status: 'skipped', age_ms: isFinite(ageMs) ? ageMs : null });
        continue;
      }
      const t0 = Date.now();
      collect(`[run]   ${stage.name} → ${stage.script}\n`);
      try {
        await runScript(stage.script, collect);
        const took = Date.now() - t0;
        collect(`[ok]    ${stage.name} done in ${(took / 1000).toFixed(1)}s\n`);
        stagesRan.push({ name: stage.name, status: 'ran', duration_ms: took });
      } catch (e) {
        const took = Date.now() - t0;
        collect(`[fail]  ${stage.name} after ${(took / 1000).toFixed(1)}s — ${e.message}\n`);
        stagesRan.push({ name: stage.name, status: 'error', duration_ms: took, error: e.message });
        await db.finishRun(run.id, { status: 'error', stagesRan, log: log.join('') });
        return { ok: false, run_id: run.id, stages: stagesRan, error: e.message };
      }
    }
    await db.finishRun(run.id, { status: 'success', stagesRan, log: log.join('') });
    return { ok: true, run_id: run.id, stages: stagesRan };
  } catch (e) {
    collect(`[fatal] ${e.message}\n`);
    await db.finishRun(run.id, { status: 'error', stagesRan, log: log.join('') });
    return { ok: false, run_id: run.id, stages: stagesRan, error: e.message };
  }
}

// Resolve the path to the latest auto-generated roster HTML (if any).
export async function latestRosterPath() {
  try {
    const dir = path.join(DATA_DIR, 'data');
    const files = await fs.readdir(dir);
    const rosters = files.filter(f => /^roster-\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort();
    if (!rosters.length) return null;
    return path.join(dir, rosters[rosters.length - 1]);
  } catch {
    return null;
  }
}
