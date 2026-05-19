// Monthly ROAS by code.
// Spend side:   .cache/meta_spend_monthly.json — per (ad, month), resolved via
//                same attribution recovery as src/roas/recover_attribution.js.
// Revenue side: Getfly accounts — month bucket = account.created_at month
//                (first-touch attribution per phone via leads sheet, then
//                revenue rolls into the month that phone first appeared in
//                Getfly as a paying customer).
//
// Outputs:
//   data/roas-monthly-by-code.csv  — long format (code, month, spend, rev, roas)
//   data/roas-monthly-top20.csv    — wide pivot, top 20 codes by YTD spend, ROAS per month
//   data/roas-monthly-totals.csv   — blended ROAS per month (across all codes)
import fs from 'node:fs';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend_monthly.json','utf8'));
const SHEET = JSON.parse(fs.readFileSync('.cache/sheet_leads.json','utf8'));
const GF = JSON.parse(fs.readFileSync('.cache/getfly.json','utf8'));

function normCode(s){return s ? s.trim().toLowerCase() : '';}
function normPhone(s){if(!s)return '';const d=String(s).replace(/[^\d]/g,'');if(d.startsWith('84')&&d.length===11)return '0'+d.slice(2);if(d.startsWith('84')&&d.length===12)return '0'+d.slice(2);if(d.length===9)return '0'+d;if(d.length===10&&d.startsWith('0'))return d;if(d.length===10)return '0'+d.slice(1);return d;}
function lpKey(url){if(!url)return null;try{const u=new URL(url);return u.hostname+u.pathname.replace(/\/$/,'')||u.hostname;}catch{return null;}}

const sheetCodes = new Set();
for (const l of SHEET) if (l.code) sheetCodes.add(l.code);

function variants(s) {
  if (!s) return new Set();
  const lc = s.trim().toLowerCase();
  const noSpace = lc.replace(/\s+/g,'');
  const noPunct = lc.replace(/[\s_\-]+/g,'');
  const vs = new Set([lc, noSpace, noPunct]);
  if (/^\d+$/.test(lc)) vs.add('code' + lc);
  if (/^\d+/.test(lc)) { vs.add('code' + noSpace); vs.add('code' + noPunct); }
  if (lc.startsWith('code')) vs.add(lc.slice(4));
  const m = lc.match(/^([a-z]+)\s*-\s*(\d+)$/);
  if (m) { vs.add(m[1] + m[2]); vs.add(m[1] + '-' + m[2]); vs.add('code' + m[2]); }
  return vs;
}
function findMatch(s) {
  if (!s) return null;
  for (const v of variants(s)) if (sheetCodes.has(v)) return v;
  return null;
}
function resolveAd(r) {
  const k = r.ad_name_norm;
  if (sheetCodes.has(k)) return {code: k, src: 'exact'};
  let m = findMatch(k); if (m) return {code: m, src: 'name-variant'};
  m = findMatch(r.adset_name); if (m) return {code: m, src: 'adset-name'};
  const aTokens = String(r.adset_name||'').split(/[+_,\s\\\/]/).map(x=>x.trim()).filter(Boolean);
  for (const t of aTokens) { const mm = findMatch(t); if (mm) return {code: mm, src: 'adset-tok'}; }
  const cTokens = String(r.campaign_name||'').split(/[+_,\s\\\/\-]/).map(x=>x.trim()).filter(t => t && t.length>=2);
  for (const t of cTokens) { const mm = findMatch(t); if (mm) return {code: mm, src: 'campaign-tok'}; }
  return null;
}

// ---- Spend per (code, month) ----
const spend = new Map(); // key: code|month -> {spend, source}
const allMonths = new Set();
let unresolvedSpend = 0;
for (const r of META) {
  const month = r.month;
  if (!month) continue;
  allMonths.add(month);
  const res = resolveAd(r);
  if (!res) { unresolvedSpend += r.spend; continue; }
  const k = res.code + '|' + month;
  if (!spend.has(k)) spend.set(k, {code: res.code, month, spend: 0});
  spend.get(k).spend += r.spend;
}

// ---- Revenue per (code, month) via leads-sheet first-touch + Getfly created_at ----
SHEET.sort((a,b)=>a.date.localeCompare(b.date));
const phoneAttrib = new Map();
for (const l of SHEET) {
  if (!l.phone) continue;
  const lp = lpKey(l.lp_url);
  if (!phoneAttrib.has(l.phone)) phoneAttrib.set(l.phone, {code: l.code || null, lp});
  else {
    const cur = phoneAttrib.get(l.phone);
    if (!cur.code && l.code) cur.code = l.code;
    if (!cur.lp && lp) cur.lp = lp;
  }
}
const phoneToAccount = {};
for (const a of GF.accounts) {
  const p = normPhone(a.phone_office);
  if (!p) continue;
  if (!phoneToAccount[p] || (+a.total_revenue||0)>(+phoneToAccount[p].total_revenue||0)) phoneToAccount[p]=a;
}
const revenue = new Map(); // key: code|month -> {revenue, paid_phones}
for (const [phone, attr] of phoneAttrib) {
  if (!attr.code) continue;
  const acct = phoneToAccount[phone];
  if (!acct || (+acct.total_revenue||0) <= 0) continue;
  const month = (acct.created_at || '').slice(0, 7);
  if (!month) continue;
  allMonths.add(month);
  const k = attr.code + '|' + month;
  if (!revenue.has(k)) revenue.set(k, {code: attr.code, month, revenue: 0, paid: 0});
  revenue.get(k).revenue += +acct.total_revenue;
  revenue.get(k).paid++;
}

// ---- Merge ----
const codes = new Set([...spend.values(), ...revenue.values()].map(r=>r.code));
const months = [...allMonths].sort().filter(m => m >= '2026-01' && m <= new Date().toISOString().slice(0,7));

const long = []; // {code, month, spend, revenue, paid, roas}
for (const code of codes) {
  for (const month of months) {
    const k = code + '|' + month;
    const s = spend.get(k)?.spend || 0;
    const r = revenue.get(k)?.revenue || 0;
    const p = revenue.get(k)?.paid || 0;
    if (s === 0 && r === 0) continue;
    long.push({ code, month, spend: s, revenue: r, paid: p, roas: s > 0 ? r/s : null });
  }
}

// ---- Output 1: long-format CSV ----
const COLS = ['Campaign (code)','Month','Spend (VND)','Revenue (VND)','Paid customers','ROAS'];
const esc = s => { const v=String(s); return v.includes(',')||v.includes('"') ? '"'+v.replace(/"/g,'""')+'"' : v; };
const longLines = [COLS.join(',')];
long.sort((a,b) => a.code.localeCompare(b.code) || a.month.localeCompare(b.month));
for (const r of long) longLines.push([esc(r.code), r.month, r.spend, r.revenue, r.paid, r.roas==null?'':r.roas.toFixed(3)].join(','));
fs.writeFileSync('data/roas-monthly-by-code.csv', '﻿' + longLines.join('\r\n') + '\r\n');

// ---- Output 2: wide-format top 20 codes (by YTD spend) ----
const ytdSpend = new Map();
for (const r of long) ytdSpend.set(r.code, (ytdSpend.get(r.code)||0) + r.spend);
const top20 = [...ytdSpend.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([c])=>c);
const wideCols = ['Campaign (code)','YTD spend (VND)','YTD revenue (VND)','YTD ROAS', ...months.flatMap(m => [m+' spend', m+' rev', m+' ROAS'])];
const wideLines = [wideCols.join(',')];
for (const code of top20) {
  const row = [esc(code)];
  let totSpend = 0, totRev = 0;
  for (const month of months) {
    const k = code + '|' + month;
    totSpend += spend.get(k)?.spend || 0;
    totRev += revenue.get(k)?.revenue || 0;
  }
  row.push(Math.round(totSpend), Math.round(totRev), totSpend>0?(totRev/totSpend).toFixed(3):'');
  for (const month of months) {
    const k = code + '|' + month;
    const s = spend.get(k)?.spend || 0;
    const r = revenue.get(k)?.revenue || 0;
    row.push(Math.round(s), Math.round(r), s>0?(r/s).toFixed(3):'');
  }
  wideLines.push(row.join(','));
}
fs.writeFileSync('data/roas-monthly-top20.csv', '﻿' + wideLines.join('\r\n') + '\r\n');

// ---- Output 3: blended monthly totals ----
const monthlyTot = new Map();
for (const r of long) {
  if (!monthlyTot.has(r.month)) monthlyTot.set(r.month, {spend:0, revenue:0, paid:0});
  const m = monthlyTot.get(r.month);
  m.spend += r.spend; m.revenue += r.revenue; m.paid += r.paid;
}
const totLines = ['Month,Spend (VND),Revenue (VND),Paid customers,ROAS'];
for (const month of months) {
  const m = monthlyTot.get(month) || {spend:0, revenue:0, paid:0};
  totLines.push([month, Math.round(m.spend), Math.round(m.revenue), m.paid, m.spend>0?(m.revenue/m.spend).toFixed(3):''].join(','));
}
fs.writeFileSync('data/roas-monthly-totals.csv', '﻿' + totLines.join('\r\n') + '\r\n');

// ---- Console summary ----
console.log('Unresolved monthly spend (codes not mappable): ' + unresolvedSpend.toLocaleString() + ' VND');
console.log('\nMonthly blended (code-attributed only):');
console.log('Month   |     Spend VND |   Revenue VND | Paid | ROAS');
console.log('--------|---------------|---------------|------|------');
for (const month of months) {
  const m = monthlyTot.get(month) || {spend:0, revenue:0, paid:0};
  console.log(`${month} | ${String(Math.round(m.spend).toLocaleString()).padStart(13)} | ${String(Math.round(m.revenue).toLocaleString()).padStart(13)} | ${String(m.paid).padStart(4)} | ${m.spend>0?(m.revenue/m.spend).toFixed(2):'—'}`);
}
console.log('\nWrote data/roas-monthly-by-code.csv (long)');
console.log('Wrote data/roas-monthly-top20.csv (wide, top 20 codes)');
console.log('Wrote data/roas-monthly-totals.csv (blended monthly)');
