// Per-code (NOT family) ranking with is_xpage flag.
// Three outputs:
//   1. data/roas-codes-ranked.csv — every code, YTD + monthly columns, is_xpage
//   2. console: top performers (Apr-May ROAS, min 2M spend)
//   3. console: laggards to investigate / pause
import fs from 'node:fs';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend_monthly.json','utf8'));
const SHEET = JSON.parse(fs.readFileSync('.cache/sheet_leads.json','utf8'));
const GF = JSON.parse(fs.readFileSync('.cache/getfly.json','utf8'));

function normPhone(s){if(!s)return '';const d=String(s).replace(/[^\d]/g,'');if(d.startsWith('84')&&d.length===11)return '0'+d.slice(2);if(d.startsWith('84')&&d.length===12)return '0'+d.slice(2);if(d.length===9)return '0'+d;if(d.length===10&&d.startsWith('0'))return d;if(d.length===10)return '0'+d.slice(1);return d;}
function lpKey(url){if(!url)return null;try{const u=new URL(url);return u.hostname+u.pathname.replace(/\/$/,'')||u.hostname;}catch{return null;}}

const sheetCodes = new Set();
for (const l of SHEET) if (l.code) sheetCodes.add(l.code);

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
function findMatch(s) { if (!s) return null; for (const v of variants(s)) if (sheetCodes.has(v)) return v; return null; }
function resolveAd(r) {
  if (sheetCodes.has(r.ad_name_norm)) return r.ad_name_norm;
  let m = findMatch(r.ad_name_norm); if (m) return m;
  m = findMatch(r.adset_name); if (m) return m;
  for (const t of String(r.adset_name||'').split(/[+_,\s\\\/]/).map(x=>x.trim()).filter(Boolean)) { const mm = findMatch(t); if (mm) return mm; }
  for (const t of String(r.campaign_name||'').split(/[+_,\s\\\/\-]/).map(x=>x.trim()).filter(t=>t&&t.length>=2)) { const mm = findMatch(t); if (mm) return mm; }
  return null;
}
const isXpage = code => /-?xpage|_xpage|-xp\b|-xp-|-kv$/i.test(code || '');

const months = ['2026-01','2026-02','2026-03','2026-04','2026-05'];
const spend = new Map(), rev = new Map();
const codeFirstMonth = new Map();
for (const r of META) {
  if (!r.month) continue;
  const code = resolveAd(r);
  if (!code) continue;
  const k = code + '|' + r.month;
  spend.set(k, (spend.get(k)||0) + r.spend);
  if (!codeFirstMonth.has(code) || r.month < codeFirstMonth.get(code)) codeFirstMonth.set(code, r.month);
}

SHEET.sort((a,b)=>a.date.localeCompare(b.date));
const phoneAttrib = new Map();
for (const l of SHEET) {
  if (!l.phone) continue;
  const lp = lpKey(l.lp_url);
  if (!phoneAttrib.has(l.phone)) phoneAttrib.set(l.phone, {code: l.code || null, lp});
  else { const cur = phoneAttrib.get(l.phone); if (!cur.code && l.code) cur.code = l.code; if (!cur.lp && lp) cur.lp = lp; }
}
const phoneToAccount = {};
for (const a of GF.accounts) {
  const p = normPhone(a.phone_office);
  if (!p) continue;
  if (!phoneToAccount[p] || (+a.total_revenue||0)>(+phoneToAccount[p].total_revenue||0)) phoneToAccount[p]=a;
}
for (const [phone, attr] of phoneAttrib) {
  if (!attr.code) continue;
  const acct = phoneToAccount[phone];
  if (!acct || (+acct.total_revenue||0) <= 0) continue;
  const month = (acct.created_at||'').slice(0,7);
  if (!month) continue;
  rev.set(attr.code + '|' + month, (rev.get(attr.code + '|' + month)||0) + (+acct.total_revenue||0));
}

const codes = new Set([...spend.keys(), ...rev.keys()].map(k=>k.split('|')[0]));
const rows = [];
for (const code of codes) {
  const monthly = {};
  let ytdS = 0, ytdR = 0;
  for (const m of months) {
    const s = spend.get(code+'|'+m) || 0;
    const r = rev.get(code+'|'+m) || 0;
    monthly[m] = {s, r};
    ytdS += s; ytdR += r;
  }
  const aprMay = ['2026-04','2026-05'];
  const recentS = aprMay.reduce((a,m)=>a+monthly[m].s, 0);
  const recentR = aprMay.reduce((a,m)=>a+monthly[m].r, 0);
  rows.push({
    code,
    is_xpage: isXpage(code),
    first_month: codeFirstMonth.get(code) || '',
    ytdS, ytdR, ytdRoas: ytdS > 0 ? ytdR / ytdS : null,
    recentS, recentR, recentRoas: recentS > 0 ? recentR / recentS : null,
    monthly,
  });
}

// CSV with is_xpage flag
const esc = s => { const v=String(s); return v.includes(',')||v.includes('"') ? '"'+v.replace(/"/g,'""')+'"' : v; };
const cols = ['Code','is_xpage','First month','YTD spend','YTD rev','YTD ROAS','Apr+May spend','Apr+May rev','Apr+May ROAS',
  ...months.flatMap(m => [m+' spend', m+' rev', m+' ROAS'])];
const lines = [cols.join(',')];
rows.sort((a,b)=>b.recentS - a.recentS);
for (const r of rows) {
  if (r.ytdS === 0 && r.ytdR === 0) continue;
  const row = [esc(r.code), r.is_xpage ? 'TRUE' : 'FALSE', r.first_month,
    Math.round(r.ytdS), Math.round(r.ytdR), r.ytdRoas==null?'':r.ytdRoas.toFixed(3),
    Math.round(r.recentS), Math.round(r.recentR), r.recentRoas==null?'':r.recentRoas.toFixed(3)];
  for (const m of months) {
    const v = r.monthly[m];
    row.push(Math.round(v.s), Math.round(v.r), v.s>0?(v.r/v.s).toFixed(3):'');
  }
  lines.push(row.join(','));
}
fs.writeFileSync('data/roas-codes-ranked.csv', '﻿' + lines.join('\r\n') + '\r\n');

// Console: top performers (Apr+May, min 2M recent spend), sorted by recent ROAS
const live = rows.filter(r => r.recentS >= 2_000_000 && r.recentRoas != null).sort((a,b)=>b.recentRoas-a.recentRoas);
console.log('=== Top 20 codes by Apr+May ROAS (min 2M recent spend) ===');
console.log('xp? ' + 'code'.padEnd(22) + 'Apr+May spend'.padStart(15) + ' rev'.padStart(13) + '  ROAS  ' + 'Apr R'.padStart(7) + ' May R'.padStart(7));
console.log('-'.repeat(85));
for (const r of live.slice(0,20)) {
  const aprS=r.monthly['2026-04'].s, aprR=r.monthly['2026-04'].r;
  const mayS=r.monthly['2026-05'].s, mayR=r.monthly['2026-05'].r;
  console.log(
    (r.is_xpage?'XP ':'   ') +
    r.code.slice(0,21).padEnd(22) +
    Math.round(r.recentS).toLocaleString().padStart(14) +
    Math.round(r.recentR).toLocaleString().padStart(13) +
    '   ' + r.recentRoas.toFixed(2).padStart(5) + ' ' +
    (aprS>0?(aprR/aprS).toFixed(2):' — ').padStart(7) +
    (mayS>0?(mayR/mayS).toFixed(2):' — ').padStart(7)
  );
}

console.log('\n=== Bottom 15 — codes burning Apr+May spend with low ROAS (min 3M recent spend) ===');
const laggards = rows.filter(r => r.recentS >= 3_000_000 && r.recentRoas != null && r.recentRoas < 0.5).sort((a,b)=>a.recentRoas-b.recentRoas);
console.log('xp? ' + 'code'.padEnd(22) + 'Apr+May spend'.padStart(15) + ' rev'.padStart(13) + '  ROAS  first-month');
for (const r of laggards.slice(0,15)) {
  console.log(
    (r.is_xpage?'XP ':'   ') +
    r.code.slice(0,21).padEnd(22) +
    Math.round(r.recentS).toLocaleString().padStart(14) +
    Math.round(r.recentR).toLocaleString().padStart(13) +
    '   ' + r.recentRoas.toFixed(2).padStart(5) +
    '   ' + r.first_month
  );
}

// Xpage vs non-xpage split (already know it works — just for reference)
const xp = rows.filter(r=>r.is_xpage);
const nxp = rows.filter(r=>!r.is_xpage);
const sumXp = xp.reduce((a,r)=>({s:a.s+r.ytdS,r:a.r+r.ytdR}),{s:0,r:0});
const sumNxp = nxp.reduce((a,r)=>({s:a.s+r.ytdS,r:a.r+r.ytdR}),{s:0,r:0});
console.log('\n=== XPAGE vs non-XPAGE YTD ===');
console.log(`  xpage codes:     ${xp.length}  spend ${sumXp.s.toLocaleString()}  rev ${sumXp.r.toLocaleString()}  ROAS ${sumXp.s>0?(sumXp.r/sumXp.s).toFixed(2):'—'}`);
console.log(`  non-xpage codes: ${nxp.length}  spend ${sumNxp.s.toLocaleString()}  rev ${sumNxp.r.toLocaleString()}  ROAS ${sumNxp.s>0?(sumNxp.r/sumNxp.s).toFixed(2):'—'}`);

console.log('\nMonthly xpage spend share:');
for (const m of months) {
  const xpS = xp.reduce((a,r)=>a + r.monthly[m].s, 0);
  const nxpS = nxp.reduce((a,r)=>a + r.monthly[m].s, 0);
  const tot = xpS + nxpS;
  const xpR = xp.reduce((a,r)=>a + r.monthly[m].r, 0);
  const nxpR = nxp.reduce((a,r)=>a + r.monthly[m].r, 0);
  console.log(`  ${m}: xpage ${(xpS/tot*100).toFixed(0)}% of ${Math.round(tot/1e6)}M spend  (xpage ROAS ${xpS>0?(xpR/xpS).toFixed(2):'—'}, non-xpage ROAS ${nxpS>0?(nxpR/nxpS).toFixed(2):'—'})`);
}

console.log('\nWrote data/roas-codes-ranked.csv (every code, with is_xpage flag, sortable in Excel)');
