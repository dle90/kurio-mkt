// Three analyses on the monthly spend data:
//   1. Code-family ROAS (group code, code-2, code-3, code-reup, code-xp, etc.)
//   2. Cohort × age matrix: codes grouped by birth month, ROAS by month-of-life
//   3. Apr-launched still-pulling: codes whose first spend is 2026-04, ranked by recent ROAS
//
// Outputs:
//   data/roas-monthly-families.csv
//   data/roas-cohort-age.csv
//   data/roas-apr-launchers.csv
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
  const k = r.ad_name_norm;
  if (sheetCodes.has(k)) return {code:k, src:'exact'};
  let m = findMatch(k); if (m) return {code:m, src:'name-variant'};
  m = findMatch(r.adset_name); if (m) return {code:m, src:'adset-name'};
  const aT = String(r.adset_name||'').split(/[+_,\s\\\/]/).map(x=>x.trim()).filter(Boolean);
  for (const t of aT) { const mm = findMatch(t); if (mm) return {code:mm, src:'adset-tok'}; }
  const cT = String(r.campaign_name||'').split(/[+_,\s\\\/\-]/).map(x=>x.trim()).filter(t=>t&&t.length>=2);
  for (const t of cT) { const mm = findMatch(t); if (mm) return {code:mm, src:'campaign-tok'}; }
  return null;
}

// Code-family inference: drop trailing -N / -reup / -xp / -tg / -xpage etc.
// to get a canonical "family". Numbers within the body of the name stay (e.g.
// code63 is its own family; code63-3 collapses to code63 family).
function familyOf(code) {
  if (!code) return code;
  let s = code;
  // strip common suffixes iteratively
  const suffixes = [/-\d+$/, /-reup$/, /-xp$/, /-xpage$/, /-xpage-kv$/, /-tg$/, /-x3$/, /-x$/, /-kv$/, /_xpage$/, /_kv$/, /-5$/, /_\d+$/];
  let changed = true;
  while (changed) {
    changed = false;
    for (const sfx of suffixes) if (sfx.test(s)) { s = s.replace(sfx, ''); changed = true; break; }
  }
  return s;
}

// ---- Resolve monthly spend ----
const spendByCodeMonth = new Map(); // code|month -> spend
const adFirstMonth = new Map(); // ad_id -> earliest month with spend
const codeMonths = new Map(); // code -> Set<month>
let unresolvedSpend = 0;
for (const r of META) {
  if (!r.month) continue;
  const res = resolveAd(r);
  if (!res) { unresolvedSpend += r.spend; continue; }
  const k = res.code + '|' + r.month;
  spendByCodeMonth.set(k, (spendByCodeMonth.get(k)||0) + r.spend);
  if (!adFirstMonth.has(r.ad_id) || r.month < adFirstMonth.get(r.ad_id)) adFirstMonth.set(r.ad_id, r.month);
  if (!codeMonths.has(res.code)) codeMonths.set(res.code, new Set());
  codeMonths.get(res.code).add(r.month);
}

// ---- Revenue by (code, month) — month bucket = Getfly account.created_at ----
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
const revByCodeMonth = new Map();
for (const [phone, attr] of phoneAttrib) {
  if (!attr.code) continue;
  const acct = phoneToAccount[phone];
  if (!acct || (+acct.total_revenue||0) <= 0) continue;
  const month = (acct.created_at||'').slice(0,7);
  if (!month) continue;
  const k = attr.code + '|' + month;
  revByCodeMonth.set(k, (revByCodeMonth.get(k)||0) + (+acct.total_revenue||0));
}

const months = ['2026-01','2026-02','2026-03','2026-04','2026-05'];

// ====================================================================
// ANALYSIS 1: Code families
// ====================================================================
const allCodes = new Set([...new Set([...spendByCodeMonth.keys(), ...revByCodeMonth.keys()].map(k=>k.split('|')[0]))]);
const familyMap = new Map(); // family -> {members:Set, spend:Map<month,n>, rev:Map<month,n>}
for (const code of allCodes) {
  const fam = familyOf(code);
  if (!familyMap.has(fam)) familyMap.set(fam, {members: new Set(), spend: new Map(), rev: new Map()});
  const e = familyMap.get(fam);
  e.members.add(code);
  for (const m of months) {
    const k = code + '|' + m;
    if (spendByCodeMonth.has(k)) e.spend.set(m, (e.spend.get(m)||0) + spendByCodeMonth.get(k));
    if (revByCodeMonth.has(k))   e.rev.set(m, (e.rev.get(m)||0) + revByCodeMonth.get(k));
  }
}

// Write family CSV (wide)
const esc = s => { const v=String(s); return v.includes(',')||v.includes('"') ? '"'+v.replace(/"/g,'""')+'"' : v; };
const famRows = [...familyMap.entries()].map(([fam, e]) => ({
  fam, members: [...e.members].sort(),
  ytdSpend: [...e.spend.values()].reduce((a,b)=>a+b,0),
  ytdRev:   [...e.rev.values()].reduce((a,b)=>a+b,0),
  spendByMonth: e.spend, revByMonth: e.rev,
})).sort((a,b)=>b.ytdSpend-a.ytdSpend);

const famCols = ['Family','Members','YTD spend','YTD revenue','YTD ROAS', ...months.flatMap(m=>[m+' spend', m+' rev', m+' ROAS'])];
const famLines = [famCols.join(',')];
for (const r of famRows) {
  if (r.ytdSpend === 0 && r.ytdRev === 0) continue;
  const row = [esc(r.fam), esc(r.members.join('|')), Math.round(r.ytdSpend), Math.round(r.ytdRev), r.ytdSpend>0?(r.ytdRev/r.ytdSpend).toFixed(3):''];
  for (const m of months) {
    const s = r.spendByMonth.get(m) || 0;
    const rv = r.revByMonth.get(m) || 0;
    row.push(Math.round(s), Math.round(rv), s>0?(rv/s).toFixed(3):'');
  }
  famLines.push(row.join(','));
}
fs.writeFileSync('data/roas-monthly-families.csv', '﻿' + famLines.join('\r\n') + '\r\n');

// ====================================================================
// ANALYSIS 2: Cohort × age (group codes by their first month of spend)
// ====================================================================
const codeFirstMonth = new Map();
for (const code of allCodes) {
  const ms = [...(codeMonths.get(code) || [])].sort();
  if (ms.length) codeFirstMonth.set(code, ms[0]);
}

// Cohort matrix: for each birth month, sum spend/rev by age (0,1,2,...)
const cohortMatrix = new Map(); // birthMonth -> Map<age, {spend, rev, codes}>
for (const code of allCodes) {
  const birth = codeFirstMonth.get(code);
  if (!birth) continue;
  if (!cohortMatrix.has(birth)) cohortMatrix.set(birth, new Map());
  const cm = cohortMatrix.get(birth);
  const birthIdx = months.indexOf(birth);
  if (birthIdx < 0) continue;
  for (let i = birthIdx; i < months.length; i++) {
    const age = i - birthIdx;
    const m = months[i];
    if (!cm.has(age)) cm.set(age, {spend:0, rev:0, codes: new Set()});
    const e = cm.get(age);
    e.spend += spendByCodeMonth.get(code+'|'+m) || 0;
    e.rev += revByCodeMonth.get(code+'|'+m) || 0;
    if ((spendByCodeMonth.get(code+'|'+m)||0) > 0) e.codes.add(code);
  }
}
const cohortLines = ['Birth cohort,N codes (life ≥M0),Age,Calendar month,Spend (VND),Revenue (VND),ROAS'];
for (const birth of months) {
  const cm = cohortMatrix.get(birth);
  if (!cm) continue;
  const m0Codes = cm.get(0)?.codes.size || 0;
  for (const age of [...cm.keys()].sort((a,b)=>a-b)) {
    const calMonth = months[months.indexOf(birth) + age];
    const e = cm.get(age);
    cohortLines.push([birth, m0Codes, age, calMonth, Math.round(e.spend), Math.round(e.rev), e.spend>0?(e.rev/e.spend).toFixed(3):''].join(','));
  }
}
fs.writeFileSync('data/roas-cohort-age.csv', '﻿' + cohortLines.join('\r\n') + '\r\n');

// ====================================================================
// ANALYSIS 3: Apr launchers — codes whose first spend month is 2026-04
// ====================================================================
const aprLaunchers = [];
for (const code of allCodes) {
  if (codeFirstMonth.get(code) !== '2026-04') continue;
  const aprSpend = spendByCodeMonth.get(code+'|2026-04') || 0;
  const maySpend = spendByCodeMonth.get(code+'|2026-05') || 0;
  const aprRev = revByCodeMonth.get(code+'|2026-04') || 0;
  const mayRev = revByCodeMonth.get(code+'|2026-05') || 0;
  const totSpend = aprSpend + maySpend;
  const totRev = aprRev + mayRev;
  if (totSpend < 1_000_000) continue; // ignore tiny spend
  aprLaunchers.push({
    code, family: familyOf(code),
    aprSpend, aprRev, aprRoas: aprSpend>0?aprRev/aprSpend:null,
    maySpend, mayRev, mayRoas: maySpend>0?mayRev/maySpend:null,
    totSpend, totRev, totRoas: totSpend>0?totRev/totSpend:null,
  });
}
aprLaunchers.sort((a,b)=>(b.totRoas||0)-(a.totRoas||0));
const aprLines = ['Code,Family,Apr spend,Apr rev,Apr ROAS,May spend,May rev,May ROAS,Apr+May spend,Apr+May rev,Apr+May ROAS'];
for (const r of aprLaunchers) {
  aprLines.push([
    esc(r.code), esc(r.family),
    Math.round(r.aprSpend), Math.round(r.aprRev), r.aprRoas==null?'':r.aprRoas.toFixed(3),
    Math.round(r.maySpend), Math.round(r.mayRev), r.mayRoas==null?'':r.mayRoas.toFixed(3),
    Math.round(r.totSpend), Math.round(r.totRev), r.totRoas==null?'':r.totRoas.toFixed(3),
  ].join(','));
}
fs.writeFileSync('data/roas-apr-launchers.csv', '﻿' + aprLines.join('\r\n') + '\r\n');

// ====================================================================
// Console summary
// ====================================================================
console.log('=== Code family rollup (top 15 by YTD spend) ===');
console.log('family'.padEnd(20) + ' members | ' + 'YTD spend'.padStart(13) + ' | ' + 'YTD rev'.padStart(13) + ' | ROAS | ' + months.map(m=>m.slice(5)+' ROAS').join(' '));
for (const r of famRows.slice(0,15)) {
  if (r.ytdSpend < 5_000_000) continue;
  const monthRoas = months.map(m => {
    const s = r.spendByMonth.get(m)||0;
    const rv = r.revByMonth.get(m)||0;
    return s>0 ? (rv/s).toFixed(2).padStart(8) : '   —   ';
  }).join(' ');
  console.log(r.fam.slice(0,18).padEnd(20) + String(r.members.length).padStart(3) + '     | ' + Math.round(r.ytdSpend).toLocaleString().padStart(13) + ' | ' + Math.round(r.ytdRev).toLocaleString().padStart(13) + ' | ' + (r.ytdSpend>0?(r.ytdRev/r.ytdSpend).toFixed(2):'—').padStart(4) + ' | ' + monthRoas);
}

console.log('\n=== Cohort × age (spend-weighted ROAS) ===');
console.log('birth cohort | N codes | M+0 | M+1 | M+2 | M+3 | M+4');
for (const birth of months) {
  const cm = cohortMatrix.get(birth);
  if (!cm) continue;
  const m0Codes = cm.get(0)?.codes.size || 0;
  const ageRoas = [0,1,2,3,4].map(age => {
    const e = cm.get(age);
    if (!e || e.spend === 0) return '   — ';
    return (e.rev/e.spend).toFixed(2).padStart(5);
  }).join(' |');
  console.log('  ' + birth + '   |   ' + String(m0Codes).padStart(3) + '  | ' + ageRoas);
}

console.log('\n=== Apr-launched codes still pulling (sorted by Apr+May ROAS) ===');
console.log('code'.padEnd(20) + 'family'.padEnd(15) + ' Apr spend'.padStart(12) + ' Apr ROAS' + ' May spend'.padStart(12) + ' May ROAS' + ' tot ROAS');
for (const r of aprLaunchers.slice(0,15)) {
  console.log(
    r.code.slice(0,18).padEnd(20) +
    r.family.slice(0,14).padEnd(15) +
    Math.round(r.aprSpend).toLocaleString().padStart(11) + '  ' +
    (r.aprRoas==null?'  —  ':r.aprRoas.toFixed(2)).padStart(8) +
    Math.round(r.maySpend).toLocaleString().padStart(11) + '  ' +
    (r.mayRoas==null?'  —  ':r.mayRoas.toFixed(2)).padStart(8) + '   ' +
    (r.totRoas==null?'  —  ':r.totRoas.toFixed(2))
  );
}
console.log('\nWrote data/roas-monthly-families.csv, data/roas-cohort-age.csv, data/roas-apr-launchers.csv');
