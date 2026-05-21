// Cohort drill-down — a CODE × DAY timeline of cohort performance.
//
// Rows = ads codes (registration cohorts), columns = registration days.
// Each cell shows the cohort's spend · regs · LTD revenue, coloured by LTD
// ROAS — GREEN once revenue ÷ spend > 1, amber/red below.
//
//   spend : Meta daily campaign spend (Kurio 2+3+5), mapped campaign→code
//   reg   : Getfly accounts created that day carrying that ads_code
//   rev   : LTD approved sale_orders.real_amount from that (day,code) cohort
//   ROAS  : rev ÷ spend  (lag-correct — same people on both sides)
//
//   Inputs:  daily spend — fetched live
//            .cache/meta_spend_monthly.json  (campaign→code map)
//            .cache/getfly_accounts.json     .cache/getfly_orders_ytd.json
//   Output:  console summary + out/cohort_drilldown.html
//
// Usage:  node src/dashboard/cohort_drilldown.js          (last 21 days)
//         DAYS=30 node src/dashboard/cohort_drilldown.js
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';
import { loadAttribution, normPhone } from '../roas/attribution.js';

const DAYS = +(process.env.DAYS || 21);
const CHUNK = +(process.env.CHUNK || 12);
const META_ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
  { id: 'act_1069029708221793', name: 'Kurio 5' },
];

const iso = d => d.toISOString().slice(0, 10);
const d10 = s => (s || '').slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US');
const norm = s => (s || '').trim().toLowerCase();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const vShort = v => v == null || !isFinite(v) ? '—' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(Math.round(v));

const today = new Date();
const days = [];
for (let i = DAYS - 1; i >= 0; i--) days.push(iso(new Date(today.getTime() - i * 86400_000)));
const since = days[0], until = days[days.length - 1];
const todayStr = iso(today);

function windows(s0, u0, size) {
  const out = [];
  let s = new Date(s0 + 'T00:00:00Z');
  const end = new Date(u0 + 'T00:00:00Z');
  while (s <= end) {
    let e = new Date(s.getTime() + (size - 1) * 86400_000);
    if (e > end) e = end;
    out.push({ since: iso(s), until: iso(e) });
    s = new Date(e.getTime() + 86400_000);
  }
  return out;
}

// ---- 1. daily campaign spend (Kurio 2 + 3 + 5) ----
async function fetchDaily() {
  const rows = [];
  for (const acc of META_ACCOUNTS) {
    for (const w of windows(since, until, CHUNK)) {
      const r = await meta.getAll(`/${acc.id}/insights`, {
        level: 'campaign',
        fields: 'campaign_name,spend',
        time_range: { since: w.since, until: w.until },
        time_increment: 1,
        limit: 500,
      });
      for (const x of r) rows.push({ date: x.date_start, campaign: x.campaign_name, spend: +x.spend || 0 });
      console.error(`  ${acc.name} ${w.since}..${w.until}: ${r.length} rows`);
      await sleep(2500);
    }
  }
  return rows;
}

console.error(`Cohort drill-down — registration days ${since} → ${until}\n`);
const daily = await fetchDaily();
const MONTHLY = JSON.parse(fs.readFileSync('.cache/meta_spend_monthly.json', 'utf8'));
const ACCOUNTS = JSON.parse(fs.readFileSync('.cache/getfly_accounts.json', 'utf8'));
const ORDERS = JSON.parse(fs.readFileSync('.cache/getfly_orders_ytd.json', 'utf8'));
const { resolveAd } = loadAttribution();

// ---- 2. campaign → code, learned from ad-level MONTHLY data ----
const campCodeSpend = new Map();
for (const r of MONTHLY) {
  const code = resolveAd(r);
  if (!code) continue;
  if (!campCodeSpend.has(r.campaign_name)) campCodeSpend.set(r.campaign_name, new Map());
  const m = campCodeSpend.get(r.campaign_name);
  m.set(code, (m.get(code) || 0) + (+r.spend || 0));
}
const campaignToCode = new Map();
for (const [cn, m] of campCodeSpend) {
  let best = null, bs = -1;
  for (const [c, s] of m) if (s > bs) { bs = s; best = c; }
  campaignToCode.set(cn, best);
}
const codeOf = name => campaignToCode.get(name) || resolveAd({ campaign_name: name, ad_name_norm: '', adset_name: '' });

// ---- 3. spend per (day, code) ----
const spendDC = new Map();
const spendDayTotal = new Map();
for (const r of daily) {
  if (!days.includes(r.date)) continue;
  spendDayTotal.set(r.date, (spendDayTotal.get(r.date) || 0) + r.spend);
  const code = codeOf(r.campaign);
  if (!code) continue;
  spendDC.set(r.date + '|' + code, (spendDC.get(r.date + '|' + code) || 0) + r.spend);
}

// ---- 4. earliest Getfly account per phone ----
const acctByPhone = new Map();
for (const a of ACCOUNTS) {
  if (!a.phone) continue;
  const cur = acctByPhone.get(a.phone);
  if (!cur || d10(a.created_at) < cur.created) {
    acctByPhone.set(a.phone, { created: d10(a.created_at), ads_code: a.ads_code || cur?.ads_code || null });
  } else if (cur && !cur.ads_code && a.ads_code) cur.ads_code = a.ads_code;
}

// ---- 5. reg per (day, code) ----
const regDC = new Map();
const regDayTotal = new Map();
for (const [, v] of acctByPhone) {
  if (!v.created || !v.ads_code || !days.includes(v.created)) continue;
  const code = norm(v.ads_code);
  regDC.set(v.created + '|' + code, (regDC.get(v.created + '|' + code) || 0) + 1);
  regDayTotal.set(v.created, (regDayTotal.get(v.created) || 0) + 1);
}

// ---- 6. LTD revenue per (day, code) ----
const revDC = new Map();
const revDayTotal = new Map();
for (const o of ORDERS) {
  if (o.status !== 2) continue;
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const acc = acctByPhone.get(normPhone(o.account_phone));
  if (!acc || !acc.created || !acc.ads_code || !days.includes(acc.created)) continue;
  if (d10(o.created_at) < acc.created) continue;
  const code = norm(acc.ads_code);
  revDC.set(acc.created + '|' + code, (revDC.get(acc.created + '|' + code) || 0) + amt);
  revDayTotal.set(acc.created, (revDayTotal.get(acc.created) || 0) + amt);
}

// ---- 7. code-level window totals ----
const codeWin = new Map();        // code -> {spend,reg,rev}
const bump = (c, k, v) => { const e = codeWin.get(c) || { spend: 0, reg: 0, rev: 0 }; e[k] += v; codeWin.set(c, e); };
for (const [k, v] of spendDC) bump(k.slice(11), 'spend', v);
for (const [k, v] of regDC) bump(k.slice(11), 'reg', v);
for (const [k, v] of revDC) bump(k.slice(11), 'rev', v);
const codeList = [...codeWin.keys()].sort((a, b) => (codeWin.get(b).spend) - (codeWin.get(a).spend));

// ---- 8. console summary ----
const P = s => console.log(s);
P('='.repeat(78));
P('  COHORT DRILL-DOWN — code × day, ' + since + ' → ' + until);
P('='.repeat(78));
P('  day           spend        reg     rev(LTD)    ROAS');
for (const d of [...days].reverse()) {
  const s = spendDayTotal.get(d) || 0, rg = regDayTotal.get(d) || 0, rv = revDayTotal.get(d) || 0;
  P(`  ${d}${d === todayStr ? '*' : ' '}  ${fmt(s).padStart(12)}  ${String(rg).padStart(5)}  ${fmt(rv).padStart(12)}    ${s ? (rv / s).toFixed(2) : '—'}`);
}
P('  * today, partial. Top codes by window LTD ROAS (spend ≥ 5M):');
for (const c of codeList.filter(c => codeWin.get(c).spend >= 5e6)
  .sort((a, b) => (codeWin.get(b).rev / codeWin.get(b).spend) - (codeWin.get(a).rev / codeWin.get(a).spend)).slice(0, 12)) {
  const w = codeWin.get(c);
  P(`    ${c.padEnd(20)} spend ${fmt(w.spend).padStart(12)}  reg ${String(w.reg).padStart(4)}  rev ${fmt(w.rev).padStart(12)}  ROAS ${(w.rev / w.spend).toFixed(2)}`);
}

// ---- 9. HTML : CODE × DAY timeline ----
const dcol = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
function roasStyle(roas) {
  if (roas == null) return '';
  if (roas >= 1) { const g = Math.min(roas - 1, 1); return `background:hsl(132 52% ${85 - g * 33}%);color:${g > 0.4 ? '#fff' : '#143314'}`; }
  return `background:hsl(38 82% ${95 - Math.min(roas, 1) * 17}%);color:#3a2d05`;
}
function cell(spend, reg, rev) {
  if (!spend && !rev) return '<td class="c x"></td>';
  const roas = spend ? rev / spend : null;
  const title = `LTD rev ${fmt(rev)}  ·  spend ${fmt(spend)}  ·  ${reg} reg  ·  ROAS ${roas != null ? roas.toFixed(2) : '—'}`;
  return `<td class="c" style="${roasStyle(roas)}" title="${title}">` +
    `<div class="rev">${rev ? vShort(rev) : '·'}</div>` +
    `<div class="sr"><span class="sp">${spend ? vShort(spend) : '0'}</span>` +
    `<span class="rg">${reg || 0}<i>r</i></span></div></td>`;
}

const headDays = days.map(d => `<th class="dh${d === todayStr ? ' td' : ''}">${dcol(d)}</th>`).join('');
let body = '';
for (const code of codeList) {
  const w = codeWin.get(code);
  const roas = w.spend ? w.rev / w.spend : null;
  body += `<tr><td class="cn">${esc(code)}</td>` +
    days.map(d => cell(spendDC.get(d + '|' + code) || 0, regDC.get(d + '|' + code) || 0, revDC.get(d + '|' + code) || 0)).join('') +
    `<td class="num">${fmt(w.spend)}</td><td class="num">${w.reg}</td><td class="num">${fmt(w.rev)}</td>` +
    `<td class="num roas" style="${roasStyle(roas)}">${roas != null ? roas.toFixed(2) : '—'}</td></tr>`;
}
const TS = days.reduce((a, d) => a + (spendDayTotal.get(d) || 0), 0);
const TR = days.reduce((a, d) => a + (regDayTotal.get(d) || 0), 0);
const TV = days.reduce((a, d) => a + (revDayTotal.get(d) || 0), 0);
const totRow = `<tr class="tot"><td class="cn">TOTAL / day</td>` +
  days.map(d => cell(spendDayTotal.get(d) || 0, regDayTotal.get(d) || 0, revDayTotal.get(d) || 0)).join('') +
  `<td class="num">${fmt(TS)}</td><td class="num">${TR}</td><td class="num">${fmt(TV)}</td>` +
  `<td class="num roas" style="${roasStyle(TS ? TV / TS : null)}">${TS ? (TV / TS).toFixed(2) : '—'}</td></tr>`;

const asOf = new Date().toISOString().slice(0, 16).replace('T', ' ');
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Kurio Ads — Cohort Drill-down</title>
<style>
:root{--bg:#f6f6f4;--panel:#fff;--ink:#1a1a1a;--muted:#6e6e6e;--border:#e3e3df;--accent:#1f5fff;--pos:#1f6e1f;}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--panel:#1a1d23;--ink:#e8e8e8;--muted:#9aa0a8;--border:#2c2f36;}}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{padding:24px 32px 14px;border-bottom:1px solid var(--border);background:var(--panel)}
h1{margin:0;font-size:20px;letter-spacing:-.02em}.sub{color:var(--muted);font-size:12.5px;margin-top:3px}
main{padding:18px 32px 80px}
h2{font-size:16px;margin:0 0 3px}.h2sub{color:var(--muted);font-size:12.5px;margin:0 0 8px;max-width:920px}
.legend{display:flex;gap:13px;flex-wrap:wrap;font-size:11px;color:var(--muted);margin:8px 0}
.legend span{display:flex;align-items:center;gap:4px}
.legend i{width:20px;height:14px;border-radius:3px;display:inline-block;border:1px solid var(--border)}
.scroll{overflow:auto;border:1px solid var(--border);border-radius:8px;max-height:84vh}
table{border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums;font-size:12px;background:var(--panel)}
th{position:sticky;top:0;background:var(--panel);text-align:center;padding:6px;
border-bottom:2px solid var(--border);font-size:10px;color:var(--muted);white-space:nowrap;z-index:2;
box-shadow:0 5px 7px -5px rgba(0,0,0,.30)}
th.cn,td.cn{text-align:left;position:sticky;left:0;background:var(--panel);min-width:174px;
border-right:2px solid var(--border);font-weight:700;font-family:"SF Mono",Menlo,monospace;font-size:11.5px}
td.cn{z-index:1;box-shadow:5px 0 7px -5px rgba(0,0,0,.24)}
th.cn{top:0;left:0;z-index:4;box-shadow:5px 5px 7px -5px rgba(0,0,0,.30)}
th.dh.td{color:var(--accent)}
td{border-bottom:1px solid var(--border)}
td.c{text-align:center;padding:3px 6px;border-left:1px solid var(--border);min-width:64px;vertical-align:middle}
td.c .rev{font-size:12.5px;font-weight:700;line-height:1.25;letter-spacing:-.02em}
td.c .sr{display:flex;justify-content:space-between;align-items:baseline;gap:8px;
font-size:9.5px;line-height:1.3;margin-top:1px;opacity:.8}
td.c .sr .sp{font-variant-numeric:tabular-nums}
td.c .sr .rg i{font-style:normal;font-size:7.5px;opacity:.6;margin-left:.5px}
td.c.x{background:transparent}
.num{text-align:right;padding:4px 8px}
.roas{font-weight:700}
tr:hover td.cn{background:color-mix(in srgb,var(--accent) 9%,var(--panel))}
tr.tot td{border-top:2px solid var(--ink);font-weight:700}tr.tot td.cn{background:var(--panel)}
.notes{margin-top:18px;padding:12px 16px;background:var(--panel);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--muted);max-width:1000px}
.notes b{color:var(--ink)}
footer{padding:20px 32px;border-top:1px solid var(--border);color:var(--muted);font-size:11.5px}
footer code{background:var(--panel);padding:1px 5px;border-radius:3px}
</style></head><body>
<header>
  <h1>Kurio Ads — Cohort Drill-down · code × day timeline</h1>
  <div class="sub">Kurio 2 + 3 + 5 · registration cohorts ${since} → ${until} · built ${asOf}</div>
</header>
<main>
  <h2>Cohort performance by code, over time</h2>
  <p class="h2sub">One row per ads code, one column per registration day. In each cell —
  the <b>big number is LTD revenue</b> from that day's registrations; the small line below is
  <b>spend</b> (left) and <b>registrations</b> (right). Cell turns
  <b style="color:var(--pos)">green</b> once LTD ROAS (revenue ÷ spend) clears 1.0; amber/red below.
  Hover for exact figures.</p>
  <div class="legend">
    <span><i style="background:hsl(132 52% 52%)"></i>ROAS ≥2</span>
    <span><i style="background:hsl(132 52% 85%)"></i>ROAS 1.0 (break-even)</span>
    <span><i style="background:hsl(38 82% 86%)"></i>ROAS ~0.5</span>
    <span><i style="background:hsl(38 82% 95%)"></i>ROAS →0</span>
    <span><i style="background:transparent"></i>not running</span>
  </div>
  <div class="scroll"><table>
    <thead><tr><th class="cn">Code</th>${headDays}
      <th class="num">Σ spend</th><th class="num">Σ reg</th><th class="num">Σ rev</th><th class="num">ROAS</th></tr></thead>
    <tbody>${body}${totRow}</tbody>
  </table></div>
  <div class="notes">
    <p><b>How to read.</b> Scan a row left→right: a code that turns and stays green is paying back.
    The right-hand columns are the <b>most recent cohorts</b> — their revenue is still arriving
    (a registration takes days–weeks to become an order), so amber on the right usually means
    "not matured yet", not "failed". Judge ROAS on the older (left) columns; judge recent days on
    spend·regs.</p>
    <p><b>Why codes.</b> Orders carry the customer's <code>ads_code</code> → code, never a campaign id,
    so revenue &amp; ROAS exist only at the code level. The TOTAL row is true daily totals — it
    includes Engage/brand spend that maps to no code, so code rows sum to slightly less.</p>
  </div>
</main>
<footer>
  <p><strong>Method.</strong> Daily spend from campaign insights (K2+3+5, live), mapped to code via
  ad-level <code>meta_spend_monthly.json</code>. Revenue = approved <code>sale_orders.real_amount</code>
  joined via the customer's Getfly <code>ads_code</code> → code; LTD = all booking days. Rebuild:
  <code>node src/dashboard/cohort_drilldown.js</code> (<code>DAYS=30</code> to widen).</p>
</footer>
</body></html>`;

fs.writeFileSync('out/cohort_drilldown.html', html);
P('');
P(`Wrote out/cohort_drilldown.html  (${codeList.length} codes × ${days.length} days)`);
