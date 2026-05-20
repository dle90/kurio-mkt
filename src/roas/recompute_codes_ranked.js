// Full rewrite of data/roas-codes-ranked.csv using ORDER-BASED revenue
// (sum of approved sale_orders.real_amount, attributed via phone → code).
//
// ATTRIBUTION SOURCE (env ATTRIB, default 'getfly'):
//   getfly — phone → Getfly account custom_fields.ads_code (first-party,
//            first-touch). Requires .cache/getfly_accounts.json. CANONICAL.
//   sheet  — phone → Google-sheet first-touch code (legacy/retired).
//   hybrid — Getfly first, sheet fills gaps. Verified to add only ~0.3%
//            revenue over pure getfly — the sheet is redundant; kept for audit.
//
// Spend numbers come from the same Meta monthly cache as before — only the
// revenue columns and ROAS columns change.
//
// Preserves the user's column layout exactly:
//   Code, is_xpage, First month,
//   YTD spend, YTD rev, YTD ROAS,
//   ,Apr+May spend, Apr+May rev, Apr+May ROAS,
//   ,YYYY-MM spend, YYYY-MM rev, YYYY-MM ROAS  × 5 months,
//   ,5/4-5/10 spend, 5/4-5/10 regs, 5/4-5/10 CPR, 5/4-5/10 rev, 5/4-5/10 ROAS,
//   ,5/11-5/17 ... (same)
import fs from 'node:fs';

const ATTRIB = (process.env.ATTRIB || 'getfly').toLowerCase(); // 'getfly' | 'sheet' | 'hybrid'
const useGetfly = ATTRIB === 'getfly' || ATTRIB === 'hybrid';
const useSheet  = ATTRIB === 'sheet'  || ATTRIB === 'hybrid';
const META = JSON.parse(fs.readFileSync('.cache/meta_spend_monthly.json','utf8'));
const RECENT = JSON.parse(fs.readFileSync('.cache/meta_spend_recent.json','utf8'));
const ORDERS_YTD = JSON.parse(fs.readFileSync('.cache/getfly_orders_ytd.json','utf8'));
const ORDERS_RECENT = JSON.parse(fs.readFileSync('.cache/getfly_orders_recent.json','utf8'));
const SHEET = useSheet ? JSON.parse(fs.readFileSync('.cache/sheet_leads.json','utf8')) : [];
const ACCOUNTS = useGetfly ? JSON.parse(fs.readFileSync('.cache/getfly_accounts.json','utf8')) : [];

const FILE_OUT = 'data/roas-codes-ranked.csv';

function normPhone(s){if(!s)return '';const d=String(s).replace(/[^\d]/g,'');if(d.startsWith('84')&&d.length===11)return '0'+d.slice(2);if(d.startsWith('84')&&d.length===12)return '0'+d.slice(2);if(d.length===9)return '0'+d;if(d.length===10&&d.startsWith('0'))return d;if(d.length===10)return '0'+d.slice(1);return d;}

// Code set used by resolveAd to map Meta campaign names -> codes.
const codeSet = new Set();
if (useGetfly) for (const a of ACCOUNTS) if (a.ads_code) codeSet.add(a.ads_code.trim().toLowerCase());
if (useSheet)  for (const l of SHEET) if (l.code) codeSet.add(l.code);

function variants(s) {
  if (!s) return new Set();
  const lc = s.trim().toLowerCase();
  const vs = new Set([lc, lc.replace(/\s+/g,''), lc.replace(/[\s_\-]+/g,'')]);
  if (/^\d+$/.test(lc)) vs.add('code' + lc);
  if (/^\d+/.test(lc)) { vs.add('code' + lc.replace(/\s+/g,'')); vs.add('code' + lc.replace(/[\s_\-]+/g,'')); }
  if (lc.startsWith('code')) vs.add(lc.slice(4));
  const m = lc.match(/^([a-z]+)\s*-\s*(\d+)$/);
  if (m) { vs.add(m[1] + m[2]); vs.add(m[1] + '-' + m[2]); vs.add('code' + m[2]); }
  return vs;
}
function findMatch(s) { if (!s) return null; for (const v of variants(s)) if (codeSet.has(v)) return v; return null; }
function resolveAd(r) {
  if (codeSet.has(r.ad_name_norm)) return r.ad_name_norm;
  let m = findMatch(r.ad_name_norm); if (m) return m;
  m = findMatch(r.adset_name); if (m) return m;
  for (const t of String(r.adset_name||'').split(/[+_,\s\\\/]/).map(x=>x.trim()).filter(Boolean)) { const mm = findMatch(t); if (mm) return mm; }
  for (const t of String(r.campaign_name||'').split(/[+_,\s\\\/\-]/).map(x=>x.trim()).filter(t=>t&&t.length>=2)) { const mm = findMatch(t); if (mm) return mm; }
  return null;
}
const isXpage = code => /-?xpage|_xpage|-xp\b|-xp-|-kv$/i.test(code || '');

const months = ['2026-01','2026-02','2026-03','2026-04','2026-05'];

// ---- Spend per (code, month) from monthly Meta cache ----
const spendByCM = new Map(); // code|month -> spend
const codeFirstMonth = new Map();
const regsByCM = new Map();
for (const r of META) {
  if (!r.month) continue;
  const code = resolveAd(r);
  if (!code) continue;
  const k = code + '|' + r.month;
  spendByCM.set(k, (spendByCM.get(k)||0) + r.spend);
  if (!codeFirstMonth.has(code) || r.month < codeFirstMonth.get(code)) codeFirstMonth.set(code, r.month);
}
// Monthly regs (was missing before — only weekly had it). Some monthly rows
// may not have actions data; missing fields default to 0.
for (const r of META) {
  if (!r.month) continue;
  const code = resolveAd(r);
  if (!code) continue;
  // Backfill: monthly fetcher didn't extract complete_registration into its
  // own field; pull from raw actions array if present
  const acts = r.actions || [];
  const regs = (acts.find(a => a.action_type === 'complete_registration')?.value) || 0;
  if (regs > 0) regsByCM.set(code + '|' + r.month, (regsByCM.get(code + '|' + r.month)||0) + (+regs || 0));
}

// ---- phone -> code attribution (first-touch) ----
// Getfly fills first; in hybrid mode the sheet then fills only phones Getfly
// didn't capture (older registrations from before ads_code existed).
const phoneToCode = new Map();
let nGetfly = 0, nSheet = 0;
if (useGetfly) {
  const sorted = [...ACCOUNTS].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||''));
  for (const a of sorted) {
    if (!a.phone || !a.ads_code) continue;
    if (!phoneToCode.has(a.phone)) { phoneToCode.set(a.phone, a.ads_code.trim().toLowerCase()); nGetfly++; }
  }
}
if (useSheet) {
  SHEET.sort((a,b)=>a.date.localeCompare(b.date));
  for (const l of SHEET) {
    if (!l.phone || !l.code) continue;
    if (!phoneToCode.has(l.phone)) { phoneToCode.set(l.phone, l.code); nSheet++; }
  }
}

const revByCM = new Map(); // code|month -> revenue
let totRevByMonth = new Map();
let unattribRevByMonth = new Map();
for (const o of ORDERS_YTD) {
  if (o.status !== 2) continue; // approved only
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const month = (o.created_at||'').slice(0,7);
  if (!month) continue;
  totRevByMonth.set(month, (totRevByMonth.get(month)||0) + amt);
  const code = phoneToCode.get(normPhone(o.account_phone));
  if (!code) {
    unattribRevByMonth.set(month, (unattribRevByMonth.get(month)||0) + amt);
    continue;
  }
  const k = code + '|' + month;
  revByCM.set(k, (revByCM.get(k)||0) + amt);
}

// ---- Weekly: spend, regs, revenue ----
const weekStarts = [...new Set(RECENT.map(r=>r.date_start || r.date))].sort();
const wLast = weekStarts[weekStarts.length-1];
const wPrior = weekStarts.length >= 2 ? weekStarts[weekStarts.length-2] : null;
const lastStop = RECENT.find(r => (r.date_start||r.date) === wLast)?.date_stop || wLast;
const priorStop = wPrior ? (RECENT.find(r => (r.date_start||r.date) === wPrior)?.date_stop || wPrior) : null;

const spendL = new Map(), spendP = new Map();
const regsL = new Map(), regsP = new Map();
for (const r of RECENT) {
  const w = r.date_start || r.date;
  const bucket = w === wLast ? 'last' : (w === wPrior ? 'prior' : null);
  if (!bucket) continue;
  const code = resolveAd(r);
  if (!code) continue;
  const sMap = bucket === 'last' ? spendL : spendP;
  const rMap = bucket === 'last' ? regsL : regsP;
  sMap.set(code, (sMap.get(code)||0) + r.spend);
  rMap.set(code, (rMap.get(code)||0) + (r.registrations || 0));
}
const revL = new Map(), revP = new Map();
const inLast = d => d >= wLast && d <= lastStop;
const inPrior = d => wPrior ? (d >= wPrior && d <= priorStop) : false;
for (const o of ORDERS_RECENT) {
  if (o.status !== 2) continue;
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const d = (o.created_at||'').slice(0,10);
  const code = phoneToCode.get(normPhone(o.account_phone));
  if (!code) continue;
  if (inLast(d)) revL.set(code, (revL.get(code)||0) + amt);
  else if (inPrior(d)) revP.set(code, (revP.get(code)||0) + amt);
}

// ---- Assemble rows ----
const allCodes = new Set();
for (const k of spendByCM.keys()) allCodes.add(k.split('|')[0]);
for (const k of revByCM.keys()) allCodes.add(k.split('|')[0]);

const rows = [];
for (const code of allCodes) {
  let ytdS = 0, ytdR = 0;
  const monthly = {};
  for (const m of months) {
    const s = spendByCM.get(code+'|'+m) || 0;
    const r = revByCM.get(code+'|'+m) || 0;
    monthly[m] = {s, r};
    ytdS += s; ytdR += r;
  }
  const aprMayS = monthly['2026-04'].s + monthly['2026-05'].s;
  const aprMayR = monthly['2026-04'].r + monthly['2026-05'].r;
  rows.push({
    code, is_xpage: isXpage(code), first_month: codeFirstMonth.get(code) || '',
    ytdS, ytdR, ytdRoas: ytdS>0?ytdR/ytdS:null,
    aprMayS, aprMayR, aprMayRoas: aprMayS>0?aprMayR/aprMayS:null,
    monthly,
    p_spend: spendP.get(code) || 0, p_regs: regsP.get(code) || 0, p_rev: revP.get(code) || 0,
    l_spend: spendL.get(code) || 0, l_regs: regsL.get(code) || 0, l_rev: revL.get(code) || 0,
  });
}
rows.sort((a,b)=>b.ytdS - a.ytdS);

// ---- CSV formatting (matches user's reformatted file) ----
const fmtN = n => {
  if (n == null) return '';
  const v = Math.round(n);
  if (v === 0) return '0';
  if (Math.abs(v) >= 1000) return '"' + v.toLocaleString('en-US') + '"';
  return String(v);
};
const fmtRoas = (n, d, has) => {
  if (!has) return '';
  if (d <= 0) return '';
  return Number((n/d).toFixed(3)).toString();
};
const fmtCpr = (spend, regs, has) => { if (!has || !spend || !regs) return ''; return fmtN(spend / regs); };

const md = iso => { const m = iso.match(/(\d{2})-(\d{2})$/); return `${+m[1]}/${+m[2]}`; };
const labelP = wPrior ? `${md(wPrior)}-${md(priorStop)}` : 'Prior 7d';
const labelL = `${md(wLast)}-${md(lastStop)}`;

const header = ['Code','is_xpage','First month',
  'YTD spend','YTD rev','YTD ROAS','',
  'Apr+May spend','Apr+May rev','Apr+May ROAS','',
  ...months.flatMap(m => [m+' spend', m+' rev', m+' ROAS', '']),
].slice(0,-1)
.concat(['',
  labelP+' spend', labelP+' regs', labelP+' CPR', labelP+' rev', labelP+' ROAS', '',
  labelL+' spend', labelL+' regs', labelL+' CPR', labelL+' rev', labelL+' ROAS',
]);

const lines = [header.join(',')];
for (const r of rows) {
  if (r.ytdS === 0 && r.ytdR === 0 && r.p_spend === 0 && r.l_spend === 0) continue;
  const hasYtd = r.ytdS > 0 || r.ytdR > 0;
  const hasAM = r.aprMayS > 0 || r.aprMayR > 0;
  const hasP = r.p_spend > 0 || r.p_regs > 0 || r.p_rev > 0;
  const hasL = r.l_spend > 0 || r.l_regs > 0 || r.l_rev > 0;
  const row = [
    r.code, r.is_xpage ? 'TRUE' : 'FALSE', r.first_month,
    fmtN(r.ytdS), fmtN(r.ytdR), fmtRoas(r.ytdR, r.ytdS, hasYtd), '',
    fmtN(r.aprMayS), fmtN(r.aprMayR), fmtRoas(r.aprMayR, r.aprMayS, hasAM), '',
  ];
  for (const m of months) {
    const v = r.monthly[m];
    const has = v.s > 0 || v.r > 0;
    row.push(fmtN(v.s), fmtN(v.r), fmtRoas(v.r, v.s, has), '');
  }
  row.pop(); // remove final trailing separator before weekly section
  row.push('',
    fmtN(hasP ? r.p_spend : null), fmtN(hasP ? r.p_regs : null), fmtCpr(r.p_spend, r.p_regs, hasP), fmtN(hasP ? r.p_rev : null), fmtRoas(r.p_rev, r.p_spend, hasP), '',
    fmtN(hasL ? r.l_spend : null), fmtN(hasL ? r.l_regs : null), fmtCpr(r.l_spend, r.l_regs, hasL), fmtN(hasL ? r.l_rev : null), fmtRoas(r.l_rev, r.l_spend, hasL)
  );
  lines.push(row.join(','));
}

fs.writeFileSync(FILE_OUT, '﻿' + lines.join('\r\n') + '\r\n');

// ---- Console: totals ----
const newYtd = rows.reduce((a,r)=>a+r.ytdR, 0);
const totSpendYtd = rows.reduce((a,r)=>a+r.ytdS, 0);

console.log(`Wrote ${FILE_OUT}: ${rows.length} code rows`);
console.log(`Attribution: ${ATTRIB.toUpperCase()}  |  code set ${codeSet.size} codes  |  phone→code map ${phoneToCode.size} phones (${nGetfly} Getfly + ${nSheet} sheet)`);
console.log(`YTD: code-attributed rev ${Math.round(newYtd).toLocaleString()}  spend ${Math.round(totSpendYtd).toLocaleString()}  blended ROAS ${(newYtd/totSpendYtd).toFixed(2)}`);

console.log('\nMonthly totals (order-based):');
for (const m of months) {
  const s = rows.reduce((a,r)=>a+r.monthly[m].s, 0);
  const rv = rows.reduce((a,r)=>a+r.monthly[m].r, 0);
  const tot = totRevByMonth.get(m) || 0;
  const unattr = unattribRevByMonth.get(m) || 0;
  console.log(`  ${m}:  spend ${Math.round(s).toLocaleString().padStart(13)}  attrib rev ${Math.round(rv).toLocaleString().padStart(13)}  ROAS ${s>0?(rv/s).toFixed(2):'—'}    | total Getfly ${Math.round(tot).toLocaleString().padStart(13)}  (attrib rate ${tot>0?Math.round(rv/tot*100):0}%)`);
}
