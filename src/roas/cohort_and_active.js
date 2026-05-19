// Two analyses, both using ORDER-BASED revenue (not account-cohort):
//   (a) Cohort × age — codes grouped by birth month, ROAS at each age
//   (b) Currently running — codes with at least one effective_status=ACTIVE ad
//
// Outputs:
//   data/roas-cohort-age.csv
//   data/roas-currently-running.csv
import fs from 'node:fs';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend_monthly.json','utf8'));
const CR = JSON.parse(fs.readFileSync('.cache/meta_creative.json','utf8'));
const SHEET = JSON.parse(fs.readFileSync('.cache/sheet_leads.json','utf8'));
const ORDERS = JSON.parse(fs.readFileSync('.cache/getfly_orders_ytd.json','utf8'));

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

// ---- Spend per (code, month) + first month per code ----
const spend = new Map();
const codeFirstMonth = new Map();
for (const r of META) {
  if (!r.month) continue;
  const code = resolveAd(r);
  if (!code) continue;
  spend.set(code + '|' + r.month, (spend.get(code + '|' + r.month)||0) + r.spend);
  if (!codeFirstMonth.has(code) || r.month < codeFirstMonth.get(code)) codeFirstMonth.set(code, r.month);
}

// ---- Phone → sheet first-touch code ----
SHEET.sort((a,b)=>a.date.localeCompare(b.date));
const phoneAttrib = new Map();
for (const l of SHEET) {
  if (!l.phone) continue;
  const lp = lpKey(l.lp_url);
  if (!phoneAttrib.has(l.phone)) phoneAttrib.set(l.phone, {code: l.code || null, lp});
  else { const cur = phoneAttrib.get(l.phone); if (!cur.code && l.code) cur.code = l.code; if (!cur.lp && lp) cur.lp = lp; }
}

// ---- Order-based revenue per (code, month) ----
const rev = new Map();
for (const o of ORDERS) {
  if (o.status !== 2) continue;
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const month = (o.created_at||'').slice(0,7);
  if (!month) continue;
  const phone = normPhone(o.account_phone);
  const attr = phoneAttrib.get(phone);
  if (!attr || !attr.code) continue;
  rev.set(attr.code + '|' + month, (rev.get(attr.code + '|' + month)||0) + amt);
}

const allCodes = new Set();
for (const k of spend.keys()) allCodes.add(k.split('|')[0]);
for (const k of rev.keys()) allCodes.add(k.split('|')[0]);

// ============================================================
// (a) COHORT × AGE — birth month = first month with spend
// ============================================================
const cohort = new Map(); // birthMonth -> Map<age, {spend, rev, codes}>
for (const code of allCodes) {
  const birth = codeFirstMonth.get(code);
  if (!birth) continue;
  if (!cohort.has(birth)) cohort.set(birth, new Map());
  const cm = cohort.get(birth);
  const birthIdx = months.indexOf(birth);
  if (birthIdx < 0) continue;
  for (let i = birthIdx; i < months.length; i++) {
    const age = i - birthIdx;
    const m = months[i];
    if (!cm.has(age)) cm.set(age, {spend:0, rev:0, codes: new Set()});
    const e = cm.get(age);
    const s = spend.get(code+'|'+m) || 0;
    const r = rev.get(code+'|'+m) || 0;
    e.spend += s;
    e.rev += r;
    if (s > 0 || r > 0) e.codes.add(code);
  }
}

const cohortLines = ['Birth cohort,N codes,Age,Calendar month,Spend (VND),Revenue (VND),ROAS'];
for (const birth of months) {
  const cm = cohort.get(birth);
  if (!cm) continue;
  const m0Codes = cm.get(0)?.codes.size || 0;
  for (const age of [...cm.keys()].sort((a,b)=>a-b)) {
    const calMonth = months[months.indexOf(birth) + age];
    const e = cm.get(age);
    cohortLines.push([birth, m0Codes, age, calMonth, Math.round(e.spend), Math.round(e.rev), e.spend>0?(e.rev/e.spend).toFixed(3):''].join(','));
  }
}
fs.writeFileSync('data/roas-cohort-age.csv', '﻿' + cohortLines.join('\r\n') + '\r\n');

// ============================================================
// (b) CURRENTLY RUNNING — codes with ≥1 effective_status=ACTIVE ad
// ============================================================
const activeAds = CR.filter(c => c.effective_status === 'ACTIVE');
const activeCodes = new Map();
const activeAdIds = new Set();
for (const a of activeAds) {
  activeAdIds.add(a.ad_id);
  const code = resolveAd({ad_name_norm: a.ad_name_norm, adset_name: a.adset_name||'', campaign_name: ''});
  if (!code) continue;
  if (!activeCodes.has(code)) activeCodes.set(code, {nAds:0, ads: new Set(), accounts: new Set(), campaigns: new Set()});
  const e = activeCodes.get(code);
  e.nAds++; e.ads.add(a.ad_id); e.accounts.add(a.account);
}
const adToMeta = new Map();
for (const r of META) {
  if (activeAdIds.has(r.ad_id)) adToMeta.set(r.ad_id, {campaign_name: r.campaign_name, adset_name: r.adset_name});
}
for (const [code, e] of activeCodes) {
  for (const adId of e.ads) {
    const m = adToMeta.get(adId);
    if (m?.campaign_name) e.campaigns.add(m.campaign_name);
  }
}

const runRows = [];
for (const [code, m] of activeCodes) {
  let ytdS=0, ytdR=0;
  const monthly = {};
  for (const mo of months) {
    const s = spend.get(code+'|'+mo) || 0;
    const r = rev.get(code+'|'+mo) || 0;
    monthly[mo] = {s, r};
    ytdS += s; ytdR += r;
  }
  runRows.push({
    code, is_xpage: isXpage(code), n_active_ads: m.nAds,
    accounts: [...m.accounts].join('|'),
    campaigns: [...m.campaigns].slice(0,3).join('|'),
    ytdS, ytdR, ytdRoas: ytdS>0?ytdR/ytdS:null,
    aprS: monthly['2026-04'].s, aprR: monthly['2026-04'].r, aprRoas: monthly['2026-04'].s>0?monthly['2026-04'].r/monthly['2026-04'].s:null,
    mayS: monthly['2026-05'].s, mayR: monthly['2026-05'].r, mayRoas: monthly['2026-05'].s>0?monthly['2026-05'].r/monthly['2026-05'].s:null,
  });
}
runRows.sort((a,b)=>b.mayS - a.mayS);

const esc = s => { const v=String(s); return v.includes(',')||v.includes('"') ? '"'+v.replace(/"/g,'""')+'"' : v; };
const runCols = ['Code','is_xpage','# active ads','Accounts','Sample campaigns',
  'YTD spend','YTD rev','YTD ROAS',
  'Apr spend','Apr rev','Apr ROAS',
  'May spend','May rev','May ROAS'];
const runLines = [runCols.join(',')];
for (const r of runRows) {
  runLines.push([
    esc(r.code), r.is_xpage?'TRUE':'FALSE', r.n_active_ads, esc(r.accounts), esc(r.campaigns),
    Math.round(r.ytdS), Math.round(r.ytdR), r.ytdRoas==null?'':r.ytdRoas.toFixed(3),
    Math.round(r.aprS), Math.round(r.aprR), r.aprRoas==null?'':r.aprRoas.toFixed(3),
    Math.round(r.mayS), Math.round(r.mayR), r.mayRoas==null?'':r.mayRoas.toFixed(3),
  ].join(','));
}
fs.writeFileSync('data/roas-currently-running.csv', '﻿' + runLines.join('\r\n') + '\r\n');

// ============================================================
// Console output
// ============================================================
console.log('=== (a) COHORT × AGE — order-based revenue ===');
console.log('birth cohort | N codes | M+0 | M+1 | M+2 | M+3 | M+4');
for (const birth of months) {
  const cm = cohort.get(birth);
  if (!cm) continue;
  const m0Codes = cm.get(0)?.codes.size || 0;
  const ageRoas = [0,1,2,3,4].map(age => {
    const e = cm.get(age);
    if (!e || e.spend === 0) return '   — ';
    return (e.rev/e.spend).toFixed(2).padStart(5);
  }).join(' |');
  console.log('  ' + birth + '   |   ' + String(m0Codes).padStart(3) + '  | ' + ageRoas);
}

console.log('\n=== (b) CURRENTLY RUNNING — sorted by May spend ===');
console.log(`${activeAds.length} ads ACTIVE → ${activeCodes.size} unique codes\n`);
console.log('xp? ' + 'code'.padEnd(22) + 'ads' + ' YTD spend'.padStart(12) + ' YTD R' + ' Apr spend'.padStart(12) + ' Apr R' + ' May spend'.padStart(12) + ' May R');
console.log('-'.repeat(100));
for (const r of runRows) {
  console.log(
    (r.is_xpage?'XP ':'   ') + r.code.slice(0,21).padEnd(22) +
    String(r.n_active_ads).padStart(3) + ' ' +
    Math.round(r.ytdS).toLocaleString().padStart(11) +
    (r.ytdRoas==null?'   — ':r.ytdRoas.toFixed(2)).padStart(6) +
    Math.round(r.aprS).toLocaleString().padStart(12) +
    (r.aprRoas==null?'   — ':r.aprRoas.toFixed(2)).padStart(6) +
    Math.round(r.mayS).toLocaleString().padStart(12) +
    (r.mayRoas==null?'   — ':r.mayRoas.toFixed(2)).padStart(6)
  );
}

const sum = arr => arr.reduce((a,r)=>({s:a.s+r.ytdS, r:a.r+r.ytdR, apS:a.apS+r.aprS, apR:a.apR+r.aprR, mS:a.mS+r.mayS, mR:a.mR+r.mayR}), {s:0,r:0,apS:0,apR:0,mS:0,mR:0});
const t = sum(runRows), tx = sum(runRows.filter(r=>r.is_xpage)), tnx = sum(runRows.filter(r=>!r.is_xpage));
console.log('\n=== Rollup (currently running) ===');
console.log(`ALL  YTD ROAS ${t.s>0?(t.r/t.s).toFixed(2):'—'}   Apr ${t.apS>0?(t.apR/t.apS).toFixed(2):'—'}   May ${t.mS>0?(t.mR/t.mS).toFixed(2):'—'}`);
console.log(`XP   YTD ROAS ${tx.s>0?(tx.r/tx.s).toFixed(2):'—'}   Apr ${tx.apS>0?(tx.apR/tx.apS).toFixed(2):'—'}   May ${tx.mS>0?(tx.mR/tx.mS).toFixed(2):'—'}`);
console.log(`nXP  YTD ROAS ${tnx.s>0?(tnx.r/tnx.s).toFixed(2):'—'}   Apr ${tnx.apS>0?(tnx.apR/tnx.apS).toFixed(2):'—'}   May ${tnx.mS>0?(tnx.mR/tnx.mS).toFixed(2):'—'}`);

console.log('\nWrote data/roas-cohort-age.csv and data/roas-currently-running.csv');
