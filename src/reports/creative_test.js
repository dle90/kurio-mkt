// Creative test verdict tool.
//
// Reads data/creative-tests.json — a registry of in-flight creative tests.
// For each entry, pulls Meta insights for the declared adset since start_date,
// applies kill / scale / winner rules (from CONTENT_STRATEGY.md defaults,
// overridable per-test), and prints a verdict report.
//
// Verdict ladder:
//   WINNER  — reg ≥ min_reg_to_winner AND CPR ≤ win_cpr            → graduate to scale
//   SCALE   — reg ≥ min_reg_to_verdict AND CPR ≤ win_cpr           → early lead, increase budget
//   KILL    — reg ≥ min_reg_to_verdict AND CPR ≥ kill_cpr          → pause
//   FATIGUE — last-7d CPR > 1.5× lifetime CPR (cell-level)         → refresh asset, do not kill cell
//   CONTINUE — within window or not enough volume yet               → run more
//
// Usage:  node src/reports/creative_test.js
//         REGISTRY=data/creative-tests.json node src/reports/creative_test.js
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';

const ACCOUNT_IDS = {
  'Kurio 2': 'act_1071893357737329',
  'Kurio 3': 'act_930175825635997',
  'Kurio 5': 'act_1069029708221793',
};
const REG_TYPE = 'complete_registration';
const REGISTRY = process.env.REGISTRY || 'data/creative-tests.json';
const iso = d => d.toISOString().slice(0, 10);
const TODAY = process.env.REPORT_TODAY || iso(new Date());
const YDAY  = iso(new Date(Date.parse(TODAY) - 86400_000));
const fmt = n => Math.round(n).toLocaleString('en-US');

const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const defaults = reg._defaults || {};
const tests = (reg.tests || []).filter(t => t.adset_id && !t.adset_id.startsWith('REPLACE'));

if (!tests.length) {
  console.error(`No live tests in ${REGISTRY}. Add an entry with a real adset_id to verdict.`);
  console.error('Example registry shape: see data/creative-tests.json');
  process.exit(0);
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);

async function fetchAdsetWindow(accId, adsetId, since, until) {
  // Pull aggregated insights for one adset over a date window.
  const rows = await meta.getAll(`/${adsetId}/insights`, {
    fields: 'spend,impressions,clicks,actions',
    time_range: { since, until },
    limit: 50,
  });
  // Single aggregated row (or empty if no spend in window).
  if (!rows.length) return { spend: 0, reg: 0, impressions: 0, clicks: 0 };
  const r = rows[0];
  const regV = +((r.actions || []).find(a => a.action_type === REG_TYPE)?.value || 0);
  return { spend: +r.spend || 0, reg: regV, impressions: +r.impressions || 0, clicks: +r.clicks || 0 };
}

const main = async () => {
  console.error(`Creative test verdicts — through ${YDAY}\n`);
  console.error(`Registry: ${REGISTRY}  (${tests.length} live test${tests.length > 1 ? 's' : ''})\n`);

  const verdicts = [];
  for (const t of tests) {
    const account = t.account || 'Kurio 2';
    const accId = ACCOUNT_IDS[account];
    if (!accId) { console.error(`Unknown account "${account}" for ${t.cell_id}; skipping.`); continue; }

    const winCpr = t.win_cpr   ?? defaults.win_cpr   ?? 195000;
    const killCpr = (t.is_scout ? (t.scout_kill_cpr ?? defaults.scout_kill_cpr) : (t.kill_cpr ?? defaults.kill_cpr)) ?? 420000;
    const minVerd = t.min_reg_to_verdict ?? defaults.min_reg_to_verdict ?? 10;
    const minWin = t.min_reg_to_winner ?? defaults.min_reg_to_winner ?? 30;
    const window = t.window_days ?? defaults.window_days ?? 14;

    console.error(`Fetching ${t.cell_id} (${t.name || ''}) ...`);
    const lifetime = await fetchAdsetWindow(accId, t.adset_id, t.start_date, YDAY);
    const last7Since = iso(new Date(Date.parse(YDAY) - 6 * 86400_000));
    const recent = await fetchAdsetWindow(accId, t.adset_id, last7Since, YDAY);

    const ageDays = daysBetween(t.start_date, YDAY) + 1;
    const cprL = lifetime.reg ? lifetime.spend / lifetime.reg : null;
    const cprR = recent.reg   ? recent.spend   / recent.reg   : null;
    const fatigueRatio = (cprL && cprR) ? cprR / cprL : null;

    let verdict, reason;
    if (lifetime.reg >= minWin && cprL != null && cprL <= winCpr) {
      verdict = 'WINNER'; reason = `${lifetime.reg} reg @ ${fmt(cprL)} CPR ≤ ${fmt(winCpr)} win line`;
    } else if (lifetime.reg >= minVerd && cprL != null && cprL >= killCpr) {
      verdict = 'KILL'; reason = `${lifetime.reg} reg @ ${fmt(cprL)} CPR ≥ ${fmt(killCpr)} kill line`;
    } else if (lifetime.reg >= minVerd && cprL != null && cprL <= winCpr) {
      verdict = 'SCALE'; reason = `${lifetime.reg} reg @ ${fmt(cprL)} CPR ≤ ${fmt(winCpr)} (pre-window winner)`;
    } else if (fatigueRatio && fatigueRatio > 1.5 && recent.reg >= 3) {
      verdict = 'FATIGUE'; reason = `recent CPR ${fmt(cprR)} vs lifetime ${fmt(cprL)} (×${fatigueRatio.toFixed(2)}) — refresh asset`;
    } else if (lifetime.reg < minVerd && ageDays >= window) {
      verdict = 'INCONCLUSIVE'; reason = `${lifetime.reg} reg after ${ageDays}d (window ${window}d, need ${minVerd}) — extend or kill on insufficient volume`;
    } else {
      verdict = 'CONTINUE'; reason = `${lifetime.reg} reg / ${ageDays}d (window ${window}d, need ${minVerd}/${minWin})`;
    }

    verdicts.push({
      cell_id: t.cell_id, name: t.name, account, format: t.format,
      ageDays, window,
      spend: lifetime.spend, reg: lifetime.reg, cpr: cprL,
      recent_spend: recent.spend, recent_reg: recent.reg, recent_cpr: cprR,
      fatigueRatio, verdict, reason, notes: t.notes || '',
    });
  }

  const P = s => console.log(s);
  const line = '='.repeat(108);
  P(line);
  P(`  CREATIVE TEST VERDICTS — through ${YDAY}`);
  P(line);
  P('  ' + 'cell'.padEnd(14) + 'name'.padEnd(34) + ' ' +
    'age'.padStart(4) + ' ' + 'reg'.padStart(4) + ' ' + 'spend'.padStart(11) + ' ' +
    'CPR'.padStart(8) + '  ' + 'verdict'.padEnd(13) + 'reason');
  P('  ' + '-'.repeat(104));
  for (const v of verdicts) {
    P('  ' + v.cell_id.slice(0, 13).padEnd(14) +
      (v.name || '').slice(0, 33).padEnd(34) + ' ' +
      String(v.ageDays).padStart(4) + ' ' +
      String(v.reg).padStart(4) + ' ' +
      fmt(v.spend).padStart(11) + ' ' +
      (v.cpr != null ? fmt(v.cpr) : '—').padStart(8) + '  ' +
      v.verdict.padEnd(13) + v.reason);
  }
  P('');
  const ct = v => verdicts.filter(x => x.verdict === v).length;
  P(`  Counts: WINNER ${ct('WINNER')} | SCALE ${ct('SCALE')} | KILL ${ct('KILL')} | FATIGUE ${ct('FATIGUE')} | INCONCLUSIVE ${ct('INCONCLUSIVE')} | CONTINUE ${ct('CONTINUE')}`);

  fs.writeFileSync('.cache/creative_test_verdicts.json', JSON.stringify(verdicts, null, 2));
  console.error('\nSaved .cache/creative_test_verdicts.json');
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
