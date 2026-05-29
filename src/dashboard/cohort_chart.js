// Standalone "Cohort revenue development" chart — Section 3 of the operating
// dashboard, built on its own so it can be refreshed fast: no 60-day daily
// pull, no creative cache. Fetches just a short daily-spend window itself.
//
//   Inputs:  daily spend  — fetched here, Kurio 2+3, last DAYS days
//            .cache/getfly_orders_ytd.json   (npm run roas:fetch:orders)
//            .cache/getfly_accounts.json     (npm run roas:fetch:accounts)
//   Output:  out/cohort.html
//
// Usage:  node src/dashboard/cohort_chart.js           (DAYS=24)
//         DAYS=30 node src/dashboard/cohort_chart.js
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { meta } from '../client.js';
import { normPhone } from '../roas/attribution.js';

// ---- optional: load latest roster snapshot for the action panel ----
function loadLatestRoster() {
  try {
    const files = fs.readdirSync('data')
      .filter(f => /^roster-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
    if (!files.length) return null;
    const latest = files[files.length - 1];
    return { file: latest, ...JSON.parse(fs.readFileSync(path.join('data', latest), 'utf8')) };
  } catch { return null; }
}

const DAYS = +(process.env.DAYS || 24);
const CHUNK = +(process.env.CHUNK || 12);
const META_ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
  { id: 'act_1069029708221793', name: 'Kurio 5' },
];

const iso = d => d.toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = new Date();
const until = iso(today);
const since = iso(new Date(today.getTime() - DAYS * 86400_000));

function windows(s0, u0, days) {
  const out = [];
  let s = new Date(s0 + 'T00:00:00Z');
  const end = new Date(u0 + 'T00:00:00Z');
  while (s <= end) {
    let e = new Date(s.getTime() + (days - 1) * 86400_000);
    if (e > end) e = end;
    out.push({ since: iso(s), until: iso(e) });
    s = new Date(e.getTime() + 86400_000);
  }
  return out;
}

// ---- 1. daily ad spend + Meta-reported registrations (Kurio 2 + 3 + 5) ----
async function fetchDailySpend() {
  const spendByDate = new Map();
  const metaRegByDate = new Map();   // Meta's complete_registration count per day — the apples-to-apples Meta-side reg
  for (const acc of META_ACCOUNTS) {
    for (const w of windows(since, until, CHUNK)) {
      const r = await meta.getAll(`/${acc.id}/insights`, {
        level: 'campaign',
        fields: 'campaign_id,spend,actions',
        time_range: { since: w.since, until: w.until },
        time_increment: 1,
        limit: 500,
      });
      for (const x of r) {
        spendByDate.set(x.date_start, (spendByDate.get(x.date_start) || 0) + (+x.spend || 0));
        const reg = +(x.actions || []).find(a => a.action_type === 'complete_registration')?.value || 0;
        if (reg) metaRegByDate.set(x.date_start, (metaRegByDate.get(x.date_start) || 0) + reg);
      }
      console.error(`  ${acc.name} ${w.since}..${w.until}: ${r.length} rows`);
      await sleep(3000);
    }
  }
  return { spendByDate, metaRegByDate };
}

console.error(`Cohort chart — daily spend ${since} → ${until}, Kurio 2+3+5\n`);
const { spendByDate, metaRegByDate } = await fetchDailySpend();
const ORDERS = JSON.parse(fs.readFileSync('.cache/getfly_orders_ytd.json', 'utf8'));
const ACCOUNTS = JSON.parse(fs.readFileSync('.cache/getfly_accounts.json', 'utf8'));

// ---- helpers (mirrors src/dashboard/build.js) ----
const d10 = s => (s || '').slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400_000);
const fmt = n => n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US');
const fmtM = n => (n / 1e6).toFixed(1) + 'M';

// continuous date axis since → until
const dates = [];
for (let d = new Date(since + 'T00:00:00Z'); iso(d) <= until; d.setUTCDate(d.getUTCDate() + 1)) dates.push(iso(d));

// =====================================================================
// COHORT REVENUE DEVELOPMENT  (Getfly accounts ↔ orders)
// =====================================================================
// phone → earliest account (created_at, ads_code, source, note)
const acctByPhone = new Map();
for (const a of ACCOUNTS) {
  if (!a.phone) continue;
  const cur = acctByPhone.get(a.phone);
  if (!cur || d10(a.created_at) < cur.created) {
    acctByPhone.set(a.phone, { created: d10(a.created_at), ads_code: a.ads_code || cur?.ads_code || null, source: a.source ?? null, note: (a.note || '').toLowerCase() });
  } else if (cur && !cur.ads_code && a.ads_code) cur.ads_code = a.ads_code;
}

// every approved order → {booking day, registration cohort, coded?, source, amt}
const orderRecs = [];
for (const o of ORDERS) {
  if (o.status !== 2) continue;
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const bd = d10(o.created_at);
  const acc = acctByPhone.get(normPhone(o.account_phone));
  const cohort = (acc && acc.created && dayDiff(acc.created, bd) >= 0) ? acc.created : null;
  orderRecs.push({ bd, cohort, coded: !!(acc && acc.ads_code), source: acc?.source ?? null, note: acc?.note || '', amt });
}

// cohort sizes — ad-coded registrations are the registration metric of record
const cohortReg = new Map(), cohortRegCoded = new Map(), cohortRegMkt = new Map();
for (const [, v] of acctByPhone) {
  if (!v.created || v.created < '2026-01-01') continue;
  cohortReg.set(v.created, (cohortReg.get(v.created) || 0) + 1);
  if (v.ads_code) cohortRegCoded.set(v.created, (cohortRegCoded.get(v.created) || 0) + 1);
  if (v.source === 31) cohortRegMkt.set(v.created, (cohortRegMkt.get(v.created) || 0) + 1);
}
// flag only egregious pile-ups (logging-batch flush) — 3× a busy-day baseline
const _sizes = [...cohortReg.values()].filter(n => n > 0).sort((a, b) => a - b);
const p90Cohort = _sizes.length ? _sizes[Math.floor(_sizes.length * 0.9)] : 0;
const isBatch = d => p90Cohort > 0 && (cohortReg.get(d) || 0) > 3 * p90Cohort;

// triangle: rows = registration cohorts, columns = calendar booking days
const N_TRI = 18;
const triCols = dates.slice(-N_TRI);
const firstCol = triCols[0];
const EARLIER_AD = '__earlier_ad__';   // ad-coded customers, cohort before the window
const AD_NOCODE = '__ad_nocode__';     // account_source = ads but the form captured no code
const RENEWAL = '__renewal__';         // existing customers re-purchasing (gia hạn)
const ORGANIC = '__organic__';         // organic page leads
const IKMC_HB = '__ikmc_hb__';         // học bổng IKMC — scholarship offers
const IKMC_LIST = '__ikmc_list__';     // IKMC contestant phone list
const APP = '__app__';                 // self-serve app sign-ups
const OTHER = '__other__';             // unmatched / undecoded — true residual
const revCD = new Map();   // rowKey -> Map(calendarDay -> amount)
for (const r of orderRecs) {
  if (r.bd < firstCol) continue;
  let key;
  if (r.coded && r.cohort && r.cohort >= firstCol) key = r.cohort;
  else if (r.coded && r.cohort) key = EARLIER_AD;
  else if (r.source === 31) key = AD_NOCODE;
  else if (r.source === 5 || /gia\s*h[aạ]n|h[aạ]n\s*\d/.test(r.note)) key = RENEWAL;
  else if (r.source === 7) key = ORGANIC;
  else if (r.source === 19) key = IKMC_HB;
  else if (r.source === 11) key = APP;
  else if (r.source === 25) key = /ikmc|th[ií]\s*sinh/i.test(r.note) ? IKMC_LIST : ORGANIC;
  else key = OTHER;
  if (!revCD.has(key)) revCD.set(key, new Map());
  const m = revCD.get(key);
  m.set(r.bd, (m.get(r.bd) || 0) + r.amt);
}
const triRows = triCols
  // Show a row whenever ANY signal exists for that day: in-window cohort
  // revenue, ad-coded reg, total CRM reg (organic counts even on ads-off
  // days), daily ad spend, or Meta Pixel reg.
  .filter(c => revCD.has(c) || cohortRegCoded.has(c) || cohortReg.has(c) || spendByDate.has(c) || metaRegByDate.has(c))
  .map(c => {
    const m = revCD.get(c) || new Map();
    const spend = spendByDate.get(c) || 0;
    const reg = cohortRegCoded.get(c) || 0;
    const regAll = cohortReg.get(c) || 0;
    const regMkt = cohortRegMkt.get(c) || 0;
    const metaReg = metaRegByDate.get(c) || 0;
    let cum = 0;
    const cells = triCols.map(d => {
      if (d < c) return null;
      const inc = m.get(d) || 0;
      cum += inc;
      return { inc, cum, roasTD: spend ? cum / spend : null };
    });
    return { cohort: c, spend, reg, regMkt, regAll, metaReg, cpr: metaReg ? spend / metaReg : null,
             cells, ltd: cum, roas: spend ? cum / spend : null, batch: isBatch(c) };
  });
// reference rows — every remaining dong by source + true total per day
const revByBd = new Map();
for (const r of orderRecs) revByBd.set(r.bd, (revByBd.get(r.bd) || 0) + r.amt);
const dailyRev = triCols.map(d => revByBd.get(d) || 0);
const refBuckets = [
  { key: EARLIER_AD, label: 'Earlier ad cohorts · pre-window', ad: true },
  { key: AD_NOCODE, label: 'Ad · code not captured', ad: true },
  { key: RENEWAL, label: 'Renewal · gia hạn', ad: false },
  { key: ORGANIC, label: 'Organic · page + walk-in', ad: false },
  { key: IKMC_HB, label: 'IKMC scholarship · học bổng', ad: false },
  { key: IKMC_LIST, label: 'IKMC contestant list', ad: false },
  { key: APP, label: 'App · self-serve sign-ups', ad: false },
  { key: OTHER, label: 'Other · untracked', ad: false },
].map(b => ({ ...b, cells: triCols.map(d => revCD.get(b.key)?.get(d) || 0) }));

// =====================================================================
// RENDER
// =====================================================================
function cohortTriangle() {
  const triCell = c => {
    if (c == null) return '<td class="tri-x"></td>';
    let style = '';
    const r = c.roasTD;
    if (r != null) {
      if (r >= 1) { const g = Math.min(r - 1, 1); style = `background:hsl(132 52% ${85 - g * 33}%);color:${g > 0.4 ? '#fff' : '#143314'}`; }
      else style = `background:hsl(38 82% ${95 - r * 17}%)`;
    }
    const day = c.inc >= 1e5 ? (c.inc / 1e6).toFixed(1) : '·';
    const cum = c.cum >= 1e5 ? (c.cum / 1e6).toFixed(1) : '';
    return `<td style="${style}">${day}<span class="cum">${cum}</span></td>`;
  };
  const dcol = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
  const head = `<tr><th class="lbl">Cohort</th><th>Spend</th><th title="Ad-coded registrations only — customers whose Getfly account carries an ads_code">Reg<br><small>ad</small></th><th title="CRM-reported new MKT leads (Getfly account_source=31) — what the team sees in the CRM 'MKT' row">MKT<br><small>new</small></th><th title="All Getfly registrations on the cohort day (ad + organic + renewal + IKMC + app)">CRM<br><small>all</small></th><th title="Meta Pixel complete_registration events that day across Kurio 2+3+5 (raw pixel fires — includes re-submissions from phone numbers already in CRM)">Pixel<br><small>reg</small></th><th title="Cost per registration = daily spend ÷ Pixel reg — matches what Meta Ads Manager shows, so it reconciles with the team's external view">CPR<br><small>by Pixel</small></th>` +
    triCols.map(d => `<th>${dcol(d)}</th>`).join('') + `<th>LTD</th><th>ROAS</th></tr>`;
  const body = triRows.map(r =>
    `<tr${r.batch ? ' class="batchrow"' : ''}><td class="lbl mono">${r.cohort.slice(5)}` +
    `${r.batch ? ' <span class="batch" title="logging-batch day">⚠</span>' : ''}</td>` +
    `<td>${r.spend ? fmtM(r.spend) : '—'}</td><td>${r.reg || '—'}</td><td class="mkt">${r.regMkt || '—'}</td><td class="crm">${r.regAll || '—'}</td><td class="meta">${r.metaReg || '—'}</td><td>${r.cpr ? fmt(r.cpr) : '—'}</td>` +
    r.cells.map(triCell).join('') +
    `<td><strong>${(r.ltd / 1e6).toFixed(1)}</strong></td>` +
    `<td class="${r.roas == null ? '' : r.roas >= 1 ? 'pos' : 'neg'}">${r.roas != null ? r.roas.toFixed(2) : '—'}</td></tr>`
  ).join('');
  const mm = v => v >= 1e5 ? (v / 1e6).toFixed(1) : '·';
  const sum = a => (a.reduce((s, v) => s + v, 0) / 1e6).toFixed(1);
  const refRows = refBuckets.map(b =>
    `<tr class="tri-earlier${b.ad ? ' tri-ad' : ''}"><td class="lbl">${b.label}</td><td></td><td></td><td></td><td></td><td></td><td></td>` +
    b.cells.map(v => `<td>${mm(v)}</td>`).join('') +
    `<td><strong>${sum(b.cells)}</strong></td><td></td></tr>`
  ).join('');
  const totRow = `<tr class="tri-tot"><td class="lbl">TOTAL daily rev →</td><td></td><td></td><td></td><td></td><td></td><td></td>` +
    dailyRev.map(v => `<td>${mm(v)}</td>`).join('') +
    `<td><strong>${sum(dailyRev)}</strong></td><td></td></tr>`;
  return `<table class="tri"><thead>${head}</thead><tbody>${body}${refRows}${totRow}</tbody></table>`;
}

function rosterPanel(r) {
  if (!r) return '';
  const escr = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const acctClass = a => a === 'Kurio 2' ? 'k2' : a === 'Kurio 3' ? 'k3' : 'k5';
  const cprClass = c => c == null ? '' : c <= r.scale_cpr ? 'good' : c >= r.cut_cpr ? 'bad' : c > r.target_cpr ? 'warn' : '';
  const roasClass = v => v == null ? 'muted' : v >= 0.9 ? 'good' : v < 0.4 ? 'bad' : v < 0.7 ? 'warn' : '';
  const roasCell = a => {
    if (a.code_roas == null) return `<td class="num muted">${a.code ? '—' : 'n/a'}</td>`;
    const conf = a.code_confidence === 'token' ? '?' : '';
    const title = `${a.code_roas_window || ''} ROAS for code ${a.code || ''}${conf ? ' (low-confidence match)' : ''}`;
    return `<td class="num ${roasClass(a.code_roas)}" title="${escr(title)}">${a.code_roas.toFixed(2)}${conf}</td>`;
  };
  const row = (a, extra) => `<tr>
    <td class="lbl-name">${escr(a.campaign_name || '')} <span class="muted">›</span> ${escr(a.adset_name || '')}</td>
    <td><span class="acct ${acctClass(a.account)}">${escr(a.account)}</span></td>
    <td class="muted code">${escr(a.code || '—')}</td>
    <td class="num">${fmt(a.spend_7d)}</td>
    <td class="num">${a.reg_7d}</td>
    <td class="num ${cprClass(a.cpr_7d)}">${a.cpr_7d != null ? fmt(a.cpr_7d) : '—'}</td>
    ${roasCell(a)}${extra || ''}
  </tr>`;
  const head = withReason => `<thead><tr><th>Campaign / Adset</th><th>Acct</th><th>Code</th><th class="num">7d spend</th><th class="num">Reg</th><th class="num">7d CPR</th><th class="num">ROAS</th>${withReason ? '<th>Reason</th>' : ''}</tr></thead>`;
  const defaultOpen = new Set(['PICK', 'WATCH', 'CUT', 'FATIGUE']);
  const block = (id, title, list, tag, withReason) => `<details class="roster-bucket roster-${tag.toLowerCase()}" ${defaultOpen.has(tag) ? 'open' : ''}>
    <summary><span class="rtag rtag-${tag.toLowerCase()}">${tag}</span> ${escr(title)} <span class="muted">(${list.length})</span></summary>
    ${list.length ? `<table class="roster-tbl">${head(withReason)}<tbody>${list.map(a => row(a, withReason ? `<td class="muted">${escr(a.note)}</td>` : '')).join('')}</tbody></table>` : '<p class="muted" style="margin:8px 0 0 18px">(none)</p>'}
  </details>`;
  const sum = r.summary;
  const cov = r.roas_coverage;
  return `
<section>
  <h2>Ad-set roster for the week — actions to take</h2>
  <p class="h2sub">Snapshot from <code>${escr(r.file)}</code>. Live ad sets: <b>${sum.live}</b>. 7d totals: spend <b>${fmt(sum.spend_7d)}</b> VND · reg <b>${sum.reg_7d}</b> · blended CPR <b>${sum.reg_7d ? fmt(sum.spend_7d / sum.reg_7d) : '—'}</b> VND.${cov ? ` ROAS overlay: ${cov.with_roas}/${cov.total_live} (${Math.round(cov.with_roas / cov.total_live * 100)}%) carry code-level ROAS. ROAS values marked "?" are from low-confidence code matches and are not gated.` : ''}</p>
  <div class="panel">
    <div class="roster-counts">
      <span class="rtag rtag-pick">PICK</span> top 5
      <span class="rtag rtag-scale">SCALE</span> ${sum.scale}
      <span class="rtag rtag-watch">WATCH</span> ${sum.watch ?? 0}
      <span class="rtag rtag-cut">CUT</span> ${sum.cut}
      <span class="rtag rtag-fatigue">FATIGUE</span> ${sum.fatigue}
      <span class="rtag rtag-hold">HOLD</span> ${sum.hold}
    </div>
    ${block('pick', 'Ad-sets of the day — top 5 by blended low-CPR × high-ROAS score (≥3 reg)', r.picks, 'PICK', false)}
    ${block('scale', 'SCALE — increase budget tomorrow', r.scale, 'SCALE', false)}
    ${block('watch', 'WATCH — cheap CPR but code ROAS marginal (0.4–0.7) — verify before scaling', r.watch || [], 'WATCH', true)}
    ${block('cut', 'CUT — pause / kill', r.cut, 'CUT', true)}
    ${block('fatigue', 'FATIGUE — refresh creative (CPR drift > 1.5×)', r.fatigue, 'FATIGUE', true)}
  </div>
</section>`;
}

const ROSTER = loadLatestRoster();
if (ROSTER) console.error(`Loaded roster overlay: ${ROSTER.file}\n`);

const asOf = new Date().toISOString().slice(0, 16).replace('T', ' ');
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Kurio Ads — Cohort Revenue Development</title>
<style>
:root{--bg:#f6f6f4;--panel:#fff;--ink:#1a1a1a;--muted:#6e6e6e;--border:#e3e3df;--accent:#1f5fff;
--scale:#1f6e1f;--kill:#b23a3a;}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--panel:#1a1d23;--ink:#e8e8e8;--muted:#9aa0a8;--border:#2c2f36;}}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{padding:26px 36px 16px;border-bottom:1px solid var(--border);background:var(--panel)}
h1{margin:0;font-size:21px;letter-spacing:-.02em}.sub{color:var(--muted);font-size:13px;margin-top:3px}
main{padding:22px 36px 80px;max-width:1280px}
section{margin-bottom:34px}h2{font-size:16px;margin:0 0 4px;letter-spacing:-.01em}
.h2sub{color:var(--muted);font-size:12.5px;margin:0 0 12px}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px 18px}
.callout{background:color-mix(in srgb,var(--accent) 7%,var(--panel));border-left:3px solid var(--accent);
padding:11px 15px;border-radius:6px;font-size:13px;margin:12px 0}
.callout b{font-weight:600}
table.tri{width:100%;border-collapse:collapse;font-size:10.5px;font-variant-numeric:tabular-nums}
table.tri th,table.tri td{padding:3px 5px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap}
table.tri th{position:sticky;top:0;background:var(--panel);font-weight:600;color:var(--muted)}
table.tri .lbl{text-align:left}
table.tri .mono{font-family:"SF Mono",Menlo,monospace;font-size:12px}
table.tri .tri-x{border-bottom:none}
table.tri .cum{display:block;font-size:8px;opacity:.55;font-weight:400;margin-top:1px}
table.tri .tri-earlier td{color:var(--muted);font-style:italic;border-top:1px solid var(--border)}
table.tri .tri-ad .lbl{color:var(--scale)}
table.tri .tri-tot td{border-top:2px solid var(--ink);font-weight:600;color:var(--muted)}
table.tri td.crm{color:var(--muted);font-weight:400}
table.tri td.mkt{color:var(--ink);font-weight:600}
table.tri td.meta{color:var(--accent);font-weight:500}
table.tri th small{display:block;font-size:8px;font-weight:400;opacity:.7;letter-spacing:.04em;margin-top:1px}
.pos{color:var(--scale);font-weight:600}.neg{color:var(--kill)}
.batch{color:var(--kill);font-weight:700}.batchrow{opacity:.55}
footer{padding:24px 36px;border-top:1px solid var(--border);color:var(--muted);font-size:12px}
footer code{background:var(--panel);padding:1px 5px;border-radius:3px}
.roster-counts{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin-bottom:14px;align-items:center}
.rtag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:.04em;color:#fff;margin-right:4px}
.rtag-pick{background:#10b981}.rtag-scale{background:#3b82f6}.rtag-watch{background:#a855f7}.rtag-cut{background:#ef4444}
.rtag-fatigue{background:#f59e0b}.rtag-hold{background:#9ca3af}
.code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:11px}
.roster-bucket{margin-top:10px;border-top:1px solid var(--border);padding-top:8px}
.roster-bucket:first-of-type{border-top:none;padding-top:0;margin-top:0}
.roster-bucket summary{cursor:pointer;font-weight:600;font-size:13px;padding:4px 0;list-style:none}
.roster-bucket summary::-webkit-details-marker{display:none}
.roster-bucket summary::before{content:"▸";display:inline-block;width:14px;color:var(--muted);transition:transform .15s}
.roster-bucket[open] summary::before{transform:rotate(90deg)}
table.roster-tbl{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums;margin-top:6px}
table.roster-tbl th,table.roster-tbl td{padding:5px 8px;text-align:left;border-bottom:1px solid var(--border)}
table.roster-tbl th{background:transparent;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
table.roster-tbl td.num,table.roster-tbl th.num{text-align:right}
table.roster-tbl tr:hover{background:color-mix(in srgb,var(--accent) 5%,transparent)}
.lbl-name{max-width:520px;overflow:hidden;text-overflow:ellipsis}
.muted{color:var(--muted)}
.num.good{color:var(--scale);font-weight:600}
.num.warn{color:#b45309}
.num.bad{color:var(--kill);font-weight:600}
.acct{display:inline-block;padding:1px 6px;border-radius:8px;font-size:10.5px;font-weight:600}
.acct.k2{background:#dbeafe;color:#1e40af}
.acct.k3{background:#dcfce7;color:#166534}
.acct.k5{background:#fef3c7;color:#92400e}
@media(prefers-color-scheme:dark){.acct.k2{background:#1e3a8a;color:#bfdbfe}.acct.k3{background:#14532d;color:#bbf7d0}.acct.k5{background:#78350f;color:#fde68a}}
</style></head><body>

<header>
  <h1>Kurio Meta Ads — Cohort Revenue Development</h1>
  <div class="sub">Kurio 2 + Kurio 3 + Kurio 5 · spend window ${since} → ${until} · built ${asOf}${ROSTER ? ` · roster overlay <code>${ROSTER.file}</code>` : ''}</div>
</header>
<main>
${rosterPanel(ROSTER)}
<section>
  <h2>Cohort revenue development</h2>
  <p class="h2sub">One row per registration day. Columns = calendar days; each cell shows revenue <b>booked that day</b> from that cohort (big number, M VND) with <b>cumulative-to-date</b> small grey below. A cell turns <span style="color:var(--scale);font-weight:700">green</span> the day cumulative revenue passes ad spend — ROAS-to-date ≥ 1 (broken even).</p>
  <div class="panel" style="overflow:auto">${cohortTriangle()}</div>
  <div class="callout"><b>Cohort ROAS</b> = LTD revenue ÷ that day's ad spend — the lag-correct return (spend and revenue from the same people). Scan a row left-to-right: how soon it goes green = payback speed; amber = still under water. <b>Reg/ad</b> counts only ads-code-attributed CRM registrations (the LP-form-captured subset); <b>MKT/new</b> is the CRM's reported new MKT leads (account_source=31) — the team's headline "ads reg" number; <b>CRM/all</b> is every Getfly account created that day across all channels; <b>Pixel/reg</b> is the Meta Pixel's raw <code>complete_registration</code> fire count. Pixel typically over-reports vs CRM-MKT because every form submission fires, even if that phone number already existed in CRM (CRM dedupes by phone, Pixel doesn't). On 2026-05-28 for example: Pixel 85 = 72 new + 13 existing-phone re-submissions. <b>CPR uses Pixel reg</b> so the number matches what Meta Ads Manager shows the team — independent of LP-form-capture failures and CRM source-routing. The reference rows below the cohorts break out every remaining dong by source — earlier ad cohorts, ad with code not captured, renewal, organic page, and other. ⚠ = logging-batch day. Spend covers Kurio 2 + 3 + 5. The rightmost column (${triCols[triCols.length - 1]}) is a partial day — its spend and revenue are still landing.</div>
</section>

</main>
<footer>
  <p><strong>Method.</strong> Daily ad spend from Meta campaign insights (Kurio 2+3+5, fetched live). Revenue = approved <code>sale_orders.real_amount</code> from <code>.cache/getfly_orders_ytd.json</code>. Cohorts join the customer's Getfly account <code>created_at</code> to their orders; codes / sources from <code>.cache/getfly_accounts.json</code>. Rebuild: <code>node src/dashboard/cohort_chart.js</code>.</p>
</footer>
</body></html>`;

fs.writeFileSync('out/cohort.html', html);
console.log(`\nWrote out/cohort.html`);
console.log(`  ${triRows.length} cohort rows · window ${triCols[0]} → ${triCols[triCols.length - 1]}`);
for (const r of triRows) {
  console.log(`  ${r.cohort}  spend ${fmt(r.spend).padStart(11)}  reg ${String(r.reg).padStart(3)} / MKT ${String(r.regMkt).padStart(3)} / CRM ${String(r.regAll).padStart(3)} / Pixel ${String(r.metaReg).padStart(3)}  LTD rev ${(r.ltd / 1e6).toFixed(1).padStart(6)}M  ROAS ${r.roas != null ? r.roas.toFixed(2) : '—'}`);
}
console.log(`\nTotal revenue booked per day (all sources, fresh Getfly orders):`);
for (const d of triCols.slice(-7)) {
  console.log(`  ${d}${d === until ? '  ← today (partial)' : ''}  ${fmt(revByBd.get(d) || 0)} VND`);
}
