// Kurio Meta Ads — operating dashboard.
//
// Visualises the decision framework: leading vs lagging metrics, the
// registration→order lag, cohort maturation, and a life-stage portfolio of
// the currently-running codes with keep/scale/kill verdicts.
//
// Inputs (all from .cache):
//   dashboard_daily.json   — 60d daily campaign insights  (src/dashboard/fetch.js)
//   meta_spend_monthly.json— YTD ad×month spend            (roas:fetch:meta)
//   meta_creative.json     — ad status + creative          (roas:fetch:creative)
//   getfly_orders_ytd.json — approved orders               (roas:fetch:orders)
//   getfly_accounts.json   — accounts + ads_code           (roas:fetch:accounts)
// Output: out/dashboard.html
import fs from 'node:fs';
import { loadAttribution, normPhone, isXpage } from '../roas/attribution.js';

// ---- tunable thresholds (take it from here) ----
const CFG = {
  benchmarkWindowDays: 30,
  recentWindowDays: 14,
  minReg7ToJudge: 5,     // <this many regs in last 7d → LEARNING, can't judge
  cprKillMult: 1.6,      // recent CPR > this × benchmark → KILL
  fatigueMult: 1.25,     // recent CPR > this × prior-period CPR → FATIGUING
  scaleRoas: 1.5, holdRoas: 1.0, watchRoas: 0.5,
  minYtdSpendForRoas: 2_000_000,  // below this, ROAS not trustworthy
};

const DAILY = JSON.parse(fs.readFileSync('.cache/dashboard_daily.json', 'utf8'));
const MONTHLY = JSON.parse(fs.readFileSync('.cache/meta_spend_monthly.json', 'utf8'));
const CREATIVE = JSON.parse(fs.readFileSync('.cache/meta_creative.json', 'utf8'));
const ORDERS = JSON.parse(fs.readFileSync('.cache/getfly_orders_ytd.json', 'utf8'));
const ACCOUNTS = JSON.parse(fs.readFileSync('.cache/getfly_accounts.json', 'utf8'));
const { resolveAd, phoneToCode } = loadAttribution();

// ---- helpers ----
const d10 = s => (s || '').slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400_000);
const fmt = n => n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US');
const fmtR = n => n == null || !isFinite(n) ? '—' : n.toFixed(2);
const pct = n => n == null || !isFinite(n) ? '—' : (n * 100).toFixed(0) + '%';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function weekStart(ds) {
  const dt = new Date(ds + 'T00:00:00Z');
  const wd = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - wd);
  return dt.toISOString().slice(0, 10);
}
const TODAY = DAILY.until;
const dates = [...new Set(DAILY.rows.map(r => r.date))].sort();
const YDAY = dates[dates.length - 1] === TODAY ? dates[dates.length - 2] : dates[dates.length - 1];

// =====================================================================
// 1. DAILY TOTALS  (60d trend)
// =====================================================================
const byDay = new Map();
for (const r of DAILY.rows) {
  const e = byDay.get(r.date) || { spend: 0, reg: 0 };
  e.spend += r.spend; e.reg += r.reg;
  byDay.set(r.date, e);
}
const trend = dates.map(dt => {
  const e = byDay.get(dt) || { spend: 0, reg: 0 };
  return { date: dt, spend: e.spend, reg: e.reg, cpr: e.reg ? e.spend / e.reg : null };
});

// revenue booked per day (approved orders)
const revByDay = new Map();
for (const o of ORDERS) {
  if (o.status !== 2) continue;
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const dt = d10(o.created_at);
  revByDay.set(dt, (revByDay.get(dt) || 0) + amt);
}
const windowSum = (n, endExclusive) => {
  // sum spend/reg over the n days ending the day before `endExclusive`
  const end = dates.indexOf(endExclusive);
  let spend = 0, reg = 0, rev = 0;
  for (let i = Math.max(0, end - n); i < end; i++) {
    const t = trend[i];
    spend += t.spend; reg += t.reg; rev += revByDay.get(t.date) || 0;
  }
  return { spend, reg, rev, cpr: reg ? spend / reg : null };
};
const yday = { ...(trend.find(t => t.date === YDAY) || { spend: 0, reg: 0, cpr: null }), rev: revByDay.get(YDAY) || 0 };
const last7 = windowSum(7, TODAY);
const prev7 = windowSum(7, dates[dates.length - 8] || TODAY);

// =====================================================================
// 2. REG→ORDER LAG  +  COHORT MATURATION  (Getfly accounts ↔ orders)
// =====================================================================
// phone → earliest account (created_at, ads_code)
const acctByPhone = new Map();
for (const a of ACCOUNTS) {
  if (!a.phone) continue;
  const cur = acctByPhone.get(a.phone);
  if (!cur || d10(a.created_at) < cur.created) {
    acctByPhone.set(a.phone, { created: d10(a.created_at), ads_code: a.ads_code || cur?.ads_code || null, source: a.source ?? null, note: (a.note || '').toLowerCase() });
  } else if (cur && !cur.ads_code && a.ads_code) cur.ads_code = a.ads_code;
}
// first approved order per phone
const firstOrderByPhone = new Map();
for (const o of ORDERS) {
  if (o.status !== 2 || (+o.real_amount || 0) <= 0) continue;
  const p = normPhone(o.account_phone);
  const dt = d10(o.created_at);
  if (!firstOrderByPhone.has(p) || dt < firstOrderByPhone.get(p)) firstOrderByPhone.set(p, dt);
}
// lag distribution (acquisition: first order − account creation)
const lagBuckets = [
  { label: 'same day', lo: 0, hi: 0 }, { label: '1 day', lo: 1, hi: 1 },
  { label: '2 days', lo: 2, hi: 2 }, { label: '3–4 d', lo: 3, hi: 4 },
  { label: '5–7 d', lo: 5, hi: 7 }, { label: '8–14 d', lo: 8, hi: 14 },
  { label: '15–30 d', lo: 15, hi: 30 }, { label: '31+ d', lo: 31, hi: 1e9 },
];
const lags = [];
for (const [phone, ord] of firstOrderByPhone) {
  const acc = acctByPhone.get(phone);
  if (!acc || !acc.created) continue;
  const lag = dayDiff(acc.created, ord);
  if (lag >= 0 && lag < 400) lags.push(lag);
}
lags.sort((a, b) => a - b);
const pctile = q => lags.length ? lags[Math.min(lags.length - 1, Math.floor(q * lags.length))] : null;
const lagStats = {
  n: lags.length, median: pctile(0.5), p75: pctile(0.75), p90: pctile(0.9),
  within7: lags.length ? lags.filter(l => l <= 7).length / lags.length : null,
  within3: lags.length ? lags.filter(l => l <= 3).length / lags.length : null,
  hist: lagBuckets.map(b => ({ label: b.label, n: lags.filter(l => l >= b.lo && l <= b.hi).length })),
};

// ---- cohort revenue-development triangle ----------------------------------
// Cohort = the day a customer's Getfly account was created. Each approved
// order → (registration cohort, calendar booking day, amount).
const orderRecs = [];          // {bd, cohort|null, coded, amt}
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
const cohortReg = new Map(), cohortRegCoded = new Map();
for (const [, v] of acctByPhone) {
  if (!v.created || v.created < '2026-01-01') continue;
  cohortReg.set(v.created, (cohortReg.get(v.created) || 0) + 1);
  if (v.ads_code) cohortRegCoded.set(v.created, (cohortRegCoded.get(v.created) || 0) + 1);
}
// flag only egregious pile-ups (holiday backlog flush) — 3× a busy-day baseline
const _sizes = [...cohortReg.values()].filter(n => n > 0).sort((a, b) => a - b);
const p90Cohort = _sizes.length ? _sizes[Math.floor(_sizes.length * 0.9)] : 0;
const isBatch = d => p90Cohort > 0 && (cohortReg.get(d) || 0) > 3 * p90Cohort;

// triangle: rows = registration cohorts, columns = calendar booking days
const N_TRI = 18;
const triCols = dates.slice(-N_TRI);
const firstCol = triCols[0];
const spendByDate = new Map(trend.map(t => [t.date, t.spend]));
const EARLIER_AD = '__earlier_ad__';   // ad-coded customers, cohort before the window
const AD_NOCODE = '__ad_nocode__';     // account_source = ads but the form captured no code
const RENEWAL = '__renewal__';         // existing customers re-purchasing (gia hạn)
const ORGANIC = '__organic__';         // organic page leads
const IKMC_HB = '__ikmc_hb__';         // học bổng IKMC — scholarship offers to top contestants
const IKMC_LIST = '__ikmc_list__';     // IKMC contestant phone list (src 25, note "Thí sinh IKMC")
const APP = '__app__';                 // self-serve app sign-ups
const OTHER = '__other__';             // unmatched / undecoded — true residual
const revCD = new Map();   // rowKey -> Map(calendarDay -> amount)
for (const r of orderRecs) {
  if (r.bd < firstCol) continue;
  // Each windowed order lands in exactly one row — a windowed ad cohort, or one
  // named reference bucket — so columns reconcile to true total daily revenue.
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
  .filter(c => revCD.has(c) || cohortRegCoded.has(c))
  .map(c => {
    const m = revCD.get(c) || new Map();
    const spend = spendByDate.get(c) || 0;
    const reg = cohortRegCoded.get(c) || 0;
    let cum = 0;
    const cells = triCols.map(d => {
      if (d < c) return null;                   // before registration — empty
      const inc = m.get(d) || 0;                // revenue booked that day
      cum += inc;                               // running cumulative
      return { inc, cum, roasTD: spend ? cum / spend : null };
    });
    return { cohort: c, spend, reg, cpr: reg ? spend / reg : null,
             cells, ltd: cum, roas: spend ? cum / spend : null, batch: isBatch(c) };
  });
// reference rows — unattributed residual + true total revenue per calendar day.
// Every windowed order is in a cohort row OR the EARLIER catch-all, so
// (cohort rows + unattributed) reconciles exactly to total daily revenue.
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
// 3. LIFE-STAGE PORTFOLIO  (currently-running codes)
// =====================================================================
// active campaigns from creative cache — campaign_id is the clean join key
const campMeta = new Map(); // campaign_id -> {active, total}
for (const a of CREATIVE) {
  if (!a.campaign_id) continue;
  if (!campMeta.has(a.campaign_id)) campMeta.set(a.campaign_id, { active: 0, total: 0 });
  const e = campMeta.get(a.campaign_id);
  e.total++;
  if (a.effective_status === 'ACTIVE') e.active++;
}

// daily spend/reg by campaign_id
const campDay = new Map(); // campaign_id -> {name, objective, days:Map(date->{spend,reg})}
for (const r of DAILY.rows) {
  if (!campDay.has(r.campaign_id)) campDay.set(r.campaign_id, { name: r.campaign, objective: r.objective, days: new Map() });
  const days = campDay.get(r.campaign_id).days;
  const e = days.get(r.date) || { spend: 0, reg: 0 };
  e.spend += r.spend; e.reg += r.reg;
  days.set(r.date, e);
}
const nD = dates.length;
const sumWin = (days, a, b) => {
  let spend = 0, reg = 0;
  for (let i = Math.max(0, a); i < b; i++) { const e = days.get(dates[i]); if (e) { spend += e.spend; reg += e.reg; } }
  return { spend, reg, cpr: reg ? spend / reg : null };
};

// benchmark CPR — last 30d, registration-driving campaigns only
let benchSpend = 0, benchReg = 0;
for (const r of DAILY.rows) {
  const age = dayDiff(r.date, TODAY);
  if (age < 1 || age > CFG.benchmarkWindowDays) continue;
  if (r.objective === 'OUTCOME_ENGAGEMENT') continue;
  benchSpend += r.spend; benchReg += r.reg;
}
const benchmarkCpr = benchReg ? benchSpend / benchReg : null;

// YTD spend per code (monthly) + YTD attributed revenue per code (orders) — code-level ROAS
const ytdSpendByCode = new Map();
for (const r of MONTHLY) {
  const code = resolveAd(r);
  if (code) ytdSpendByCode.set(code, (ytdSpendByCode.get(code) || 0) + (+r.spend || 0));
}
const ytdRevByCode = new Map();
for (const o of ORDERS) {
  if (o.status !== 2 || (+o.real_amount || 0) <= 0) continue;
  const code = phoneToCode.get(normPhone(o.account_phone));
  if (code) ytdRevByCode.set(code, (ytdRevByCode.get(code) || 0) + (+o.real_amount || 0));
}

// campaign_name → code, learned from MONTHLY where resolveAd has ad + adset
// names to work with. Resolving campaign names alone splits on '-' and
// mis-maps multi-part codes (code83-xpage-kv → code83).
const campCodeSpend = new Map(); // campaign_name -> Map(code -> spend)
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

function verdict(c) {
  if (c.reg7 < CFG.minReg7ToJudge) return { tag: 'LEARNING', cls: 'v-learn', note: 'Too few registrations to judge — leave it alone, give it a fixed test budget.' };
  if (c.cprRecent != null && benchmarkCpr && c.cprRecent > CFG.cprKillMult * benchmarkCpr)
    return { tag: 'KILL · CPR', cls: 'v-kill', note: `CPR ${fmt(c.cprRecent)} is >${CFG.cprKillMult}× the ${fmt(benchmarkCpr)} benchmark — cut without waiting for revenue.` };
  if (c.roas == null) return { tag: 'WATCH · revenue pending', cls: 'v-watch', note: 'CPR acceptable; ROAS not yet readable. Hold at test budget until the cohort matures.' };
  if (c.roas >= CFG.scaleRoas) return c.fatigue
    ? { tag: 'HOLD · refresh', cls: 'v-hold', note: 'Strong ROAS but CPR is rising — fatigue. Stop scaling, queue a replacement creative.' }
    : { tag: 'SCALE', cls: 'v-scale', note: 'ROAS strong, CPR stable — fund the next budget increment (gradually, ≤30%).' };
  if (c.roas >= CFG.holdRoas) return { tag: 'HOLD', cls: 'v-hold', note: 'Profitable — hold budget.' + (c.fatigue ? ' CPR rising; watch for fatigue.' : '') };
  if (c.roas >= CFG.watchRoas) return { tag: 'WATCH', cls: 'v-watch', note: 'Below breakeven — trim budget or fix; do not scale.' };
  return { tag: 'KILL · ROAS', cls: 'v-kill', note: 'ROAS below 0.5 — cut.' };
}

const portfolio = [];
for (const [cid, cm] of campMeta) {
  if (cm.active < 1) continue;                   // only campaigns with a live ad
  const cd = campDay.get(cid);
  if (!cd) continue;                             // active but no spend in the 60d window
  const w7 = sumWin(cd.days, nD - 8, nD - 1);
  const wRec = sumWin(cd.days, nD - 1 - CFG.recentWindowDays, nD - 1);
  const wPri = sumWin(cd.days, nD - 1 - 2 * CFG.recentWindowDays, nD - 1 - CFG.recentWindowDays);
  const code = campaignToCode.get(cd.name) || resolveAd({ ad_name_norm: '', adset_name: '', campaign_name: cd.name });
  const ytdS = code ? (ytdSpendByCode.get(code) || 0) : 0;
  const ytdR = code ? (ytdRevByCode.get(code) || 0) : 0;
  const roas = ytdS >= CFG.minYtdSpendForRoas ? ytdR / ytdS : null;
  const fatigue = wRec.cpr != null && wPri.cpr != null && wRec.reg >= 5 && wPri.reg >= 5 && wRec.cpr > CFG.fatigueMult * wPri.cpr;
  const row = {
    cid, campaign: cd.name, code: code || null, isXpage: isXpage(code),
    activeAds: cm.active, totalAds: cm.total,
    spend7: w7.spend, reg7: w7.reg, cprRecent: wRec.cpr, cprPrior: wPri.cpr, fatigue,
    ytdS, ytdR, roas,
  };
  row.verdict = verdict(row);
  portfolio.push(row);
}
const vRank = { SCALE: 0, HOLD: 1, WATCH: 2, LEARNING: 3, KILL: 4 };
portfolio.sort((a, b) =>
  (vRank[a.verdict.tag.split(/[ ·]/)[0]] ?? 9) - (vRank[b.verdict.tag.split(/[ ·]/)[0]] ?? 9) || b.spend7 - a.spend7);
const vCount = {};
for (const r of portfolio) { const k = r.verdict.tag.split(/[ ·]/)[0]; vCount[k] = (vCount[k] || 0) + 1; }

// =====================================================================
// 4. SOURCE MIX  (revenue last 30d by channel)
// =====================================================================
const acctFull = new Map(); // phone -> {ads_code, source, note}
for (const a of ACCOUNTS) {
  if (!a.phone) continue;
  if (!acctFull.has(a.phone) || a.ads_code) acctFull.set(a.phone, { ads_code: a.ads_code, source: a.source, note: (a.note || '').toLowerCase() });
}
const srcMix = { ad: 0, organic: 0, renewal: 0, other: 0 };
const srcMixN = { ad: 0, organic: 0, renewal: 0, other: 0 };
const cutoff30 = dates[Math.max(0, nD - 31)];
for (const o of ORDERS) {
  if (o.status !== 2 || (+o.real_amount || 0) <= 0) continue;
  if (d10(o.created_at) < cutoff30) continue;
  const amt = +o.real_amount || 0;
  const a = acctFull.get(normPhone(o.account_phone));
  let b;
  if (a?.ads_code) b = 'ad';
  else if (a && (a.source === 5 || /gia\s*h[aạ]n|h[aạ]n\s*\d/.test(a.note || ''))) b = 'renewal';
  else if (a && a.source === 7) b = 'organic';
  else b = 'other';
  srcMix[b] += amt; srcMixN[b]++;
}
const srcTotal = Object.values(srcMix).reduce((a, b) => a + b, 0) || 1;

// =====================================================================
// RENDER
// =====================================================================
const SVG_W = 920, SVG_H = 170;
function trendSvg() {
  const pad = 34, days = trend;
  const maxSpend = Math.max(...days.map(d => d.spend), 1);
  const cprVals = days.map(d => d.cpr).filter(v => v != null);
  const maxCpr = Math.max(...cprVals, 1);
  const bw = (SVG_W - 2 * pad) / days.length;
  const bars = days.map((d, i) => {
    const h = (d.spend / maxSpend) * (SVG_H - 2 * pad);
    return `<rect x="${(pad + i * bw).toFixed(1)}" y="${(SVG_H - pad - h).toFixed(1)}" width="${(bw * 0.78).toFixed(1)}" height="${h.toFixed(1)}" fill="#2c6ecf" opacity="0.55"/>`;
  }).join('');
  let path = '', started = false;
  days.forEach((d, i) => {
    if (d.cpr == null) return;
    const x = pad + i * bw + bw * 0.39, y = SVG_H - pad - (d.cpr / maxCpr) * (SVG_H - 2 * pad);
    path += `${started ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `; started = true;
  });
  const ticks = days.filter((_, i) => i % 10 === 0).map((d, j) =>
    `<text x="${(pad + days.indexOf(d) * bw).toFixed(1)}" y="${SVG_H - 8}" class="ax">${d.date.slice(5)}</text>`).join('');
  return `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" class="chart">
    <text x="4" y="14" class="ax">spend (bars) · CPR (line)</text>
    ${bars}<path d="${path}" fill="none" stroke="#b23a3a" stroke-width="2"/>${ticks}</svg>`;
}

const fmtM = n => (n / 1e6).toFixed(1) + 'M';
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
  const head = `<tr><th class="lbl">Cohort</th><th>Spend</th><th>Reg</th><th>CPR</th>` +
    triCols.map(d => `<th>${dcol(d)}</th>`).join('') + `<th>LTD</th><th>ROAS</th></tr>`;
  const body = triRows.map(r =>
    `<tr${r.batch ? ' class="batchrow"' : ''}><td class="lbl mono">${r.cohort.slice(5)}` +
    `${r.batch ? ' <span class="batch" title="logging-batch day">⚠</span>' : ''}</td>` +
    `<td>${r.spend ? fmtM(r.spend) : '—'}</td><td>${r.reg || '—'}</td><td>${r.cpr ? fmt(r.cpr) : '—'}</td>` +
    r.cells.map(triCell).join('') +
    `<td><strong>${(r.ltd / 1e6).toFixed(1)}</strong></td>` +
    `<td class="${r.roas == null ? '' : r.roas >= 1 ? 'pos' : 'neg'}">${r.roas != null ? r.roas.toFixed(2) : '—'}</td></tr>`
  ).join('');
  const mm = v => v >= 1e5 ? (v / 1e6).toFixed(1) : '·';
  const sum = a => (a.reduce((s, v) => s + v, 0) / 1e6).toFixed(1);
  const refRows = refBuckets.map(b =>
    `<tr class="tri-earlier${b.ad ? ' tri-ad' : ''}"><td class="lbl">${b.label}</td><td></td><td></td><td></td>` +
    b.cells.map(v => `<td>${mm(v)}</td>`).join('') +
    `<td><strong>${sum(b.cells)}</strong></td><td></td></tr>`
  ).join('');
  const totRow = `<tr class="tri-tot"><td class="lbl">TOTAL daily rev →</td><td></td><td></td><td></td>` +
    dailyRev.map(v => `<td>${mm(v)}</td>`).join('') +
    `<td><strong>${sum(dailyRev)}</strong></td><td></td></tr>`;
  return `<table class="tri"><thead>${head}</thead><tbody>${body}${refRows}${totRow}</tbody></table>`;
}

function lagBars() {
  const max = Math.max(...lagStats.hist.map(h => h.n), 1);
  return lagStats.hist.map(h =>
    `<div class="lagrow"><span class="laglbl">${h.label}</span>
      <span class="lagbar" style="width:${(h.n / max * 100).toFixed(1)}%"></span>
      <span class="lagn">${h.n}</span></div>`).join('');
}

function portfolioRows() {
  return portfolio.map(r => `<tr>
    <td class="mono camp">${esc(r.campaign.replace(/^CVS[_ ]?TUANTA[_ ]?/i, '').slice(0, 36))}</td>
    <td class="mono">${esc(r.code || '—')}${r.isXpage ? ' <span class="xp">XP</span>' : ''}</td>
    <td class="num">${r.activeAds}/${r.totalAds}</td>
    <td class="num">${fmt(r.spend7)}</td>
    <td class="num">${r.reg7}</td>
    <td class="num">${fmt(r.cprRecent)}</td>
    <td class="num">${r.fatigue ? '<span class="fat">▲ rising</span>' : (r.cprPrior != null ? 'stable' : '—')}</td>
    <td class="num">${fmtR(r.roas)}</td>
    <td><span class="vtag ${r.verdict.cls}">${esc(r.verdict.tag)}</span></td>
    <td class="note">${esc(r.verdict.note)}</td>
  </tr>`).join('');
}

const asOf = new Date().toISOString().slice(0, 16).replace('T', ' ');
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Kurio Ads — Operating Dashboard</title>
<style>
:root{--bg:#f6f6f4;--panel:#fff;--ink:#1a1a1a;--muted:#6e6e6e;--border:#e3e3df;--accent:#1f5fff;
--scale:#1f6e1f;--hold:#9b6b00;--watch:#9b6b00;--kill:#b23a3a;--learn:#6e6e6e;}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--panel:#1a1d23;--ink:#e8e8e8;--muted:#9aa0a8;--border:#2c2f36;}}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{padding:26px 36px 16px;border-bottom:1px solid var(--border);background:var(--panel)}
h1{margin:0;font-size:21px;letter-spacing:-.02em}.sub{color:var(--muted);font-size:13px;margin-top:3px}
main{padding:22px 36px 80px;max-width:1280px}
section{margin-bottom:34px}h2{font-size:16px;margin:0 0 4px;letter-spacing:-.01em}
.h2sub{color:var(--muted);font-size:12.5px;margin:0 0 12px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:8px}
.kpi{background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:13px 15px}
.kpi .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.kpi .v{font-size:21px;font-weight:600;letter-spacing:-.02em;margin-top:3px}
.kpi .d{font-size:11.5px;color:var(--muted);margin-top:2px}
.up{color:var(--scale)}.down{color:var(--kill)}
.panel{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:16px 18px}
.callout{background:color-mix(in srgb,var(--accent) 7%,var(--panel));border-left:3px solid var(--accent);
padding:11px 15px;border-radius:6px;font-size:13px;margin:12px 0}
.callout b{font-weight:600}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:13px}
th{text-align:left;padding:8px 9px;border-bottom:2px solid var(--border);font-weight:600;font-size:12px;color:var(--muted)}
td{padding:7px 9px;border-bottom:1px solid var(--border);vertical-align:top}
tr:last-child td{border-bottom:none}.num{text-align:right}.mono{font-family:"SF Mono",Menlo,monospace;font-size:12px}
.note{color:var(--muted);font-size:12px;max-width:340px}
.xp{font-size:9px;font-weight:700;color:var(--accent);border:1px solid var(--accent);border-radius:3px;padding:0 3px}
.vtag{font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap;color:#fff}
.v-scale{background:var(--scale)}.v-hold{background:var(--hold)}.v-watch{background:#b8902a}
.v-kill{background:var(--kill)}.v-learn{background:var(--learn)}
.fat{color:var(--kill);font-weight:600}
.chart{width:100%;height:auto;background:var(--panel);border:1px solid var(--border);border-radius:9px;margin-top:8px}
.chart .ax{font-size:9px;fill:var(--muted)}
table.grid td,table.grid th{text-align:center;padding:6px 8px}table.grid td.mono{text-align:left}
.cg-na{color:var(--border)}
.batch{color:var(--kill);font-weight:700}.batchrow{opacity:.55}
table.tri{width:100%;border-collapse:collapse;font-size:10.5px;font-variant-numeric:tabular-nums}
table.tri th,table.tri td{padding:3px 5px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap}
table.tri th{position:sticky;top:0;background:var(--panel);font-weight:600;color:var(--muted)}
table.tri .lbl{text-align:left}
table.tri .tri-x{border-bottom:none}
table.tri .cum{display:block;font-size:8px;opacity:.55;font-weight:400;margin-top:1px}
table.tri .tri-earlier td{color:var(--muted);font-style:italic;border-top:1px solid var(--border)}
table.tri .tri-ad .lbl{color:var(--scale)}
table.tri .tri-tot td{border-top:2px solid var(--ink);font-weight:600;color:var(--muted)}
.pos{color:var(--scale);font-weight:600}.neg{color:var(--kill)}
.lagrow{display:flex;align-items:center;gap:8px;margin:3px 0}
.laglbl{width:66px;font-size:12px;color:var(--muted);text-align:right}
.lagbar{height:15px;background:#2c6ecf;border-radius:3px;min-width:2px}
.lagn{font-size:12px;color:var(--muted)}
.mixbar{height:30px;display:flex;border-radius:6px;overflow:hidden;border:1px solid var(--border);margin:8px 0}
.mixbar>div{display:flex;align-items:center;justify-content:center;color:#fff;font-size:11.5px;font-weight:600}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px;color:var(--muted)}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:860px){.cols2{grid-template-columns:1fr}}
footer{padding:24px 36px;border-top:1px solid var(--border);color:var(--muted);font-size:12px}
footer code{background:var(--panel);padding:1px 5px;border-radius:3px}
</style></head><body>

<header>
  <h1>Kurio Meta Ads — Operating Dashboard</h1>
  <div class="sub">Kurio 2 + Kurio 3 · daily window ${DAILY.since} → ${DAILY.until} · built ${asOf}</div>
</header>
<main>

<section>
  <h2>1 · Yesterday & the week</h2>
  <p class="h2sub">Leading indicators — known the same day. Act on these; confirm with revenue later.</p>
  <div class="kpis">
    <div class="kpi"><div class="l">Spend · ${YDAY.slice(5)}</div><div class="v">${fmt(yday.spend)}</div><div class="d">VND</div></div>
    <div class="kpi"><div class="l">Registrations</div><div class="v">${yday.reg}</div><div class="d">complete_registration</div></div>
    <div class="kpi"><div class="l">CPR</div><div class="v">${fmt(yday.cpr)}</div><div class="d">vs benchmark ${fmt(benchmarkCpr)}</div></div>
    <div class="kpi"><div class="l">Revenue booked</div><div class="v">${fmt(yday.rev)}</div><div class="d">approved orders (lagged)</div></div>
    <div class="kpi"><div class="l">Last 7d spend</div><div class="v">${fmt(last7.spend)}</div><div class="d">${last7.spend > prev7.spend ? '<span class="down">▲</span>' : '<span class="up">▼</span>'} ${pct(Math.abs((last7.spend - prev7.spend) / (prev7.spend || 1)))} vs prior 7d</div></div>
    <div class="kpi"><div class="l">Last 7d CPR</div><div class="v">${fmt(last7.cpr)}</div><div class="d">${last7.cpr > prev7.cpr ? '<span class="down">▲ worse</span>' : '<span class="up">▼ better</span>'} vs ${fmt(prev7.cpr)}</div></div>
  </div>
  ${trendSvg()}
</section>

<section>
  <h2>2 · The lag — why daily ROAS lies</h2>
  <p class="h2sub">A registration becomes revenue days later. Revenue booked today reflects ad spend from the past, not today's.</p>
  <div class="cols2">
    <div class="panel">
      <strong style="font-size:13px">Registration → first order lag</strong>
      <div style="margin:10px 0">${lagBars()}</div>
      <div style="font-size:12.5px;color:var(--muted)">n=${lagStats.n} converted customers · median <b>${lagStats.median}d</b> · p75 <b>${lagStats.p75}d</b> · p90 <b>${lagStats.p90}d</b></div>
    </div>
    <div class="panel">
      <strong style="font-size:13px">What this means</strong>
      <ul style="font-size:13px;padding-left:18px;margin:10px 0">
        <li><b>${pct(lagStats.within3)}</b> of conversions land within 3 days, <b>${pct(lagStats.within7)}</b> within 7.</li>
        <li>A registration cohort is only ~complete after <b>${lagStats.p90} days</b> (p90). Don't judge a code's ROAS before then.</li>
        <li>Today's revenue line is still <b>maturing</b> — recent cohorts will keep adding orders for ~${lagStats.p90} days.</li>
      </ul>
    </div>
  </div>
</section>

<section>
  <h2>3 · Cohort revenue development</h2>
  <p class="h2sub">One row per registration day. Columns = calendar days; each cell shows revenue <b>booked that day</b> from that cohort (big number, M VND) with <b>cumulative-to-date</b> small grey below. A cell turns <span style="color:var(--scale);font-weight:700">green</span> the day cumulative revenue passes ad spend — ROAS-to-date ≥ 1 (broken even).</p>
  <div class="panel" style="overflow:auto">${cohortTriangle()}</div>
  <div class="callout"><b>Cohort ROAS</b> = LTD revenue ÷ that day's ad spend — the lag-correct return (spend and revenue from the same people). Scan a row left-to-right: how soon it goes green = payback speed; amber = still under water. The reference rows below the cohorts break out every remaining dong by source — earlier ad cohorts, ad with code not captured, renewal, organic page, and other — so each column reconciles to total daily revenue. Green labels are still ad-driven. ⚠ = logging-batch day (created_at piled up). Spend is Kurio 2+3 only until Kurio 5 is wired in.</div>
</section>

<section>
  <h2>4 · Today's roster — life-stage portfolio</h2>
  <p class="h2sub">Every currently-running campaign, judged by the metric its data can support. ${portfolio.length} campaigns · ${Object.entries(vCount).map(([k, v]) => `${v} ${k}`).join(' · ')}</p>
  <div class="panel" style="padding:0;overflow:auto">
    <table>
      <thead><tr><th>Campaign</th><th>Code</th><th class="num">Ads</th><th class="num">Spend 7d</th><th class="num">Reg 7d</th>
        <th class="num">CPR ${CFG.recentWindowDays}d</th><th class="num">Trend</th><th class="num">ROAS</th><th>Verdict</th><th>What to do</th></tr></thead>
      <tbody>${portfolioRows()}</tbody>
    </table>
  </div>
  <div class="callout"><b>Budget rule:</b> cap total spend at what sales can convert. Fund <span class="vtag v-scale">SCALE</span> codes the next increment (≤30% step). Hold <span class="vtag v-watch">WATCH</span>/<span class="vtag v-learn">LEARNING</span> at test budget. Cut <span class="vtag v-kill">KILL</span>. Keep ~20% of budget for new-creative tests — winners fatigue fast. ROAS is YTD code-level (mature); CPR is the last ${CFG.recentWindowDays}d (current).</div>
</section>

<section>
  <h2>5 · Revenue by source — last 30 days</h2>
  <p class="h2sub">Four different businesses. Don't manage them with one ROAS number.</p>
  <div class="mixbar">
    ${['ad', 'organic', 'renewal', 'other'].map((k, i) => srcMix[k] > 0
      ? `<div style="flex:${srcMix[k]};background:${['#2c6ecf', '#6a9cd4', '#9b6b00', '#b8b8b8'][i]}">${(srcMix[k] / srcTotal * 100).toFixed(0)}%</div>` : '').join('')}
  </div>
  <div class="legend">
    <span><i style="background:#2c6ecf"></i>Meta ad code — ${fmt(srcMix.ad)} VND (${srcMixN.ad} orders)</span>
    <span><i style="background:#6a9cd4"></i>Organic page — ${fmt(srcMix.organic)} (${srcMixN.organic})</span>
    <span><i style="background:#9b6b00"></i>Renewal / upsell — ${fmt(srcMix.renewal)} (${srcMixN.renewal})</span>
    <span><i style="background:#b8b8b8"></i>Other / unknown — ${fmt(srcMix.other)} (${srcMixN.other})</span>
  </div>
  <div class="callout"><b>Halo blindspot:</b> the non-ad slices may still be ad-induced (brand search, direct app installs). Watch whether they rise & fall <i>with</i> spend over the weeks — if they do, paid ROAS is under-credited. The only clean read is a deliberate spend holdout.</div>
</section>

<section>
  <h2>6 · Sales throughput <span style="font-weight:400;color:var(--muted);font-size:13px">— not yet wired</span></h2>
  <div class="callout">Conversion varies by sales rep and that's a major lever, but the order cache doesn't carry the rep yet. <b>v2 needs:</b> order <code>creator</code> / <code>sale_user</code> + account owner from Getfly → then: leads assigned vs contacted per rep, conversion by rep <i>within</i> a lead-source segment (so good leads going to a strong closer isn't mistaken for a good ad), and uncontacted-lead backlog.</div>
</section>

</main>
<footer>
  <p><strong>Method.</strong> Daily spend + registrations from Meta campaign insights (60d). Revenue = approved <code>sale_orders.real_amount</code>. Lag &amp; cohorts join the customer's Getfly account <code>created_at</code> to their first approved order. Codes resolved via Getfly <code>ads_code</code> (see <code>src/roas/attribution.js</code>). ROAS in the roster is YTD code-level; CPR is the recent window.</p>
  <p><strong>Thresholds</strong> (edit in <code>src/dashboard/build.js</code> CFG): KILL if CPR &gt; ${CFG.cprKillMult}× benchmark · FATIGUE if CPR &gt; ${CFG.fatigueMult}× prior ${CFG.recentWindowDays}d · SCALE/HOLD/WATCH at ROAS ${CFG.scaleRoas}/${CFG.holdRoas}/${CFG.watchRoas}. Rebuild: <code>npm run dashboard</code>.</p>
</footer>
</body></html>`;

fs.writeFileSync('out/dashboard.html', html);
console.log(`Wrote out/dashboard.html`);
console.log(`  roster: ${portfolio.length} codes · ${Object.entries(vCount).map(([k, v]) => `${v} ${k}`).join(', ')}`);
console.log(`  lag: median ${lagStats.median}d, p90 ${lagStats.p90}d, n=${lagStats.n}`);
console.log(`  benchmark CPR: ${fmt(benchmarkCpr)} VND`);
console.log(`  source mix 30d: ad ${pct(srcMix.ad / srcTotal)} · organic ${pct(srcMix.organic / srcTotal)} · renewal ${pct(srcMix.renewal / srcTotal)} · other ${pct(srcMix.other / srcTotal)}`);
