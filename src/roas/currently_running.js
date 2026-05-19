// Filter to ads with effective_status='ACTIVE' (currently delivering), find
// the codes they map to, and report YTD / April / May ROAS for each.
//
// "Currently-running code" = code mapped to by at least one ACTIVE ad. ROAS
// values are historical aggregates for the full code, not just the active ads.
//
// Output: data/roas-currently-running.csv
import fs from 'node:fs';

const CR = JSON.parse(fs.readFileSync('.cache/meta_creative.json','utf8'));
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

// 1) ACTIVE ads → resolve codes
const activeAds = CR.filter(c => c.effective_status === 'ACTIVE');
const activeCodes = new Map(); // code -> {nAds:int, accounts:Set, campaigns:Set}
const activeAdIds = new Set();
for (const a of activeAds) {
  activeAdIds.add(a.ad_id);
  // creative records use same ad_name_norm; reuse resolver
  const code = resolveAd({ad_name_norm: a.ad_name_norm, adset_name: a.adset_name||'', campaign_name: ''});
  if (!code) continue;
  if (!activeCodes.has(code)) activeCodes.set(code, {nAds:0, ads: new Set(), accounts: new Set(), campaigns: new Set()});
  const e = activeCodes.get(code);
  e.nAds++;
  e.ads.add(a.ad_id);
  e.accounts.add(a.account);
}
// also pull campaign_name from META cache (creative cache doesn't have it; spend cache does)
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

// 2) Historical spend per (code, month) — same recovery
const spend = new Map();
for (const r of META) {
  if (!r.month) continue;
  const code = resolveAd(r);
  if (!code) continue;
  spend.set(code + '|' + r.month, (spend.get(code + '|' + r.month)||0) + r.spend);
}

// 3) Historical revenue per (code, month)
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
const rev = new Map();
for (const [phone, attr] of phoneAttrib) {
  if (!attr.code) continue;
  const acct = phoneToAccount[phone];
  if (!acct || (+acct.total_revenue||0) <= 0) continue;
  const month = (acct.created_at||'').slice(0,7);
  if (!month) continue;
  rev.set(attr.code + '|' + month, (rev.get(attr.code + '|' + month)||0) + (+acct.total_revenue||0));
}

// 4) Build rows
const months = ['2026-01','2026-02','2026-03','2026-04','2026-05'];
const rows = [];
for (const [code, meta] of activeCodes) {
  let ytdS = 0, ytdR = 0;
  const monthly = {};
  for (const m of months) {
    const s = spend.get(code+'|'+m) || 0;
    const r = rev.get(code+'|'+m) || 0;
    monthly[m] = {s, r};
    ytdS += s; ytdR += r;
  }
  rows.push({
    code, is_xpage: isXpage(code),
    n_active_ads: meta.nAds,
    accounts: [...meta.accounts].join('|'),
    campaigns: [...meta.campaigns].slice(0,3).join('|'),
    ytdSpend: ytdS, ytdRev: ytdR, ytdRoas: ytdS>0?ytdR/ytdS:null,
    aprSpend: monthly['2026-04'].s, aprRev: monthly['2026-04'].r, aprRoas: monthly['2026-04'].s>0?monthly['2026-04'].r/monthly['2026-04'].s:null,
    maySpend: monthly['2026-05'].s, mayRev: monthly['2026-05'].r, mayRoas: monthly['2026-05'].s>0?monthly['2026-05'].r/monthly['2026-05'].s:null,
  });
}
rows.sort((a,b)=>b.maySpend - a.maySpend);

// Total active ads not mapped to a code
const unmappedActive = activeAds.filter(a => !resolveAd({ad_name_norm: a.ad_name_norm, adset_name: a.adset_name||'', campaign_name: ''}));

const esc = s => { const v=String(s); return v.includes(',')||v.includes('"') ? '"'+v.replace(/"/g,'""')+'"' : v; };
const cols = ['Code','is_xpage','# active ads','Accounts','Sample campaigns',
  'YTD spend','YTD rev','YTD ROAS',
  'Apr spend','Apr rev','Apr ROAS',
  'May spend','May rev','May ROAS'];
const lines = [cols.join(',')];
for (const r of rows) {
  lines.push([
    esc(r.code), r.is_xpage?'TRUE':'FALSE', r.n_active_ads, esc(r.accounts), esc(r.campaigns),
    Math.round(r.ytdSpend), Math.round(r.ytdRev), r.ytdRoas==null?'':r.ytdRoas.toFixed(3),
    Math.round(r.aprSpend), Math.round(r.aprRev), r.aprRoas==null?'':r.aprRoas.toFixed(3),
    Math.round(r.maySpend), Math.round(r.mayRev), r.mayRoas==null?'':r.mayRoas.toFixed(3),
  ].join(','));
}
fs.writeFileSync('data/roas-currently-running.csv', '﻿' + lines.join('\r\n') + '\r\n');

console.log(`\n${activeAds.length} ads currently ACTIVE  →  ${activeCodes.size} unique codes  (${unmappedActive.length} active ads couldn't be code-mapped)`);
console.log('\n=== Currently running campaigns: YTD / Apr / May ROAS ===');
console.log('Sorted by May spend desc\n');
console.log('xp? ' + 'code'.padEnd(22) + ' ads' + ' YTD spend'.padStart(13) + ' YTD R ' + ' Apr spend'.padStart(13) + ' Apr R ' + ' May spend'.padStart(13) + ' May R');
console.log('-'.repeat(108));
for (const r of rows) {
  console.log(
    (r.is_xpage?'XP ':'   ') +
    r.code.slice(0,21).padEnd(22) +
    String(r.n_active_ads).padStart(4) + '  ' +
    Math.round(r.ytdSpend).toLocaleString().padStart(11) +
    (r.ytdRoas==null?'    —':r.ytdRoas.toFixed(2)).padStart(7) + '   ' +
    Math.round(r.aprSpend).toLocaleString().padStart(11) +
    (r.aprRoas==null?'    —':r.aprRoas.toFixed(2)).padStart(7) + '   ' +
    Math.round(r.maySpend).toLocaleString().padStart(11) +
    (r.mayRoas==null?'    —':r.mayRoas.toFixed(2)).padStart(7)
  );
}

// Rollup
const sum = arr => arr.reduce((a,r)=>({s:a.s+r.ytdSpend, r:a.r+r.ytdRev, apS:a.apS+r.aprSpend, apR:a.apR+r.aprRev, mS:a.mS+r.maySpend, mR:a.mR+r.mayRev}), {s:0,r:0,apS:0,apR:0,mS:0,mR:0});
const t = sum(rows);
const tx = sum(rows.filter(r=>r.is_xpage));
const tnx = sum(rows.filter(r=>!r.is_xpage));
console.log('\n=== Rollup ===');
console.log(`ALL  YTD: spend ${Math.round(t.s).toLocaleString()}  rev ${Math.round(t.r).toLocaleString()}  ROAS ${t.s>0?(t.r/t.s).toFixed(2):'—'}`);
console.log(`     Apr: spend ${Math.round(t.apS).toLocaleString()}  rev ${Math.round(t.apR).toLocaleString()}  ROAS ${t.apS>0?(t.apR/t.apS).toFixed(2):'—'}`);
console.log(`     May: spend ${Math.round(t.mS).toLocaleString()}  rev ${Math.round(t.mR).toLocaleString()}  ROAS ${t.mS>0?(t.mR/t.mS).toFixed(2):'—'}`);
console.log(`XP   YTD: spend ${Math.round(tx.s).toLocaleString()}  rev ${Math.round(tx.r).toLocaleString()}  ROAS ${tx.s>0?(tx.r/tx.s).toFixed(2):'—'}`);
console.log(`     Apr: spend ${Math.round(tx.apS).toLocaleString()}  ROAS ${tx.apS>0?(tx.apR/tx.apS).toFixed(2):'—'}`);
console.log(`     May: spend ${Math.round(tx.mS).toLocaleString()}  ROAS ${tx.mS>0?(tx.mR/tx.mS).toFixed(2):'—'}`);
console.log(`nXP  YTD: spend ${Math.round(tnx.s).toLocaleString()}  rev ${Math.round(tnx.r).toLocaleString()}  ROAS ${tnx.s>0?(tnx.r/tnx.s).toFixed(2):'—'}`);
console.log(`     Apr: spend ${Math.round(tnx.apS).toLocaleString()}  ROAS ${tnx.apS>0?(tnx.apR/tnx.apS).toFixed(2):'—'}`);
console.log(`     May: spend ${Math.round(tnx.mS).toLocaleString()}  ROAS ${tnx.mS>0?(tnx.mR/tnx.mS).toFixed(2):'—'}`);

console.log('\nWrote data/roas-currently-running.csv');
