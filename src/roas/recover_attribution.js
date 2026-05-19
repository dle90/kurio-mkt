// Per-ad-row attribution recovery: when Meta's ad_name_norm isn't in the leads
// sheet, fall back through adset name -> adset tokens -> campaign tokens.
// Produces .cache/meta_spend_recovered.json with a `code_resolved` and
// `code_source` field on every row, plus a recovered-ROAS-by-code CSV.

import fs from 'node:fs';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend.json','utf8'));
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
  if (/^\d+$/.test(lc)) { vs.add('code' + lc); }
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

// Tag rows + aggregate spend per (code, source)
const tagged = [];
const spendByCode = new Map();
const ctxByCode = new Map();
let totSpend = 0, totUnresolved = 0;
for (const r of META) {
  totSpend += r.spend;
  const res = resolveAd(r);
  const code = res ? res.code : null;
  const src = res ? res.src : 'unresolved';
  tagged.push({ ...r, code_resolved: code, code_source: src });
  if (code) {
    if (!spendByCode.has(code)) spendByCode.set(code, {spend:0, sources:{}});
    spendByCode.get(code).spend += r.spend;
    spendByCode.get(code).sources[src] = (spendByCode.get(code).sources[src]||0) + r.spend;
  } else {
    totUnresolved += r.spend;
    if (!ctxByCode.has(r.ad_name_norm||'(no-name)')) ctxByCode.set(r.ad_name_norm||'(no-name)', {spend:0, sample:{cn:r.campaign_name,an:r.adset_name}});
    ctxByCode.get(r.ad_name_norm||'(no-name)').spend += r.spend;
  }
}

fs.writeFileSync('.cache/meta_spend_recovered.json', JSON.stringify(tagged, null, 2));

// Revenue per code (reuse compute.js logic, with same first-touch attribution)
SHEET.sort((a,b)=>a.date.localeCompare(b.date));
const phoneAttrib = new Map();
for (const lead of SHEET) {
  if (!lead.phone) continue;
  const lp = lpKey(lead.lp_url);
  if (!phoneAttrib.has(lead.phone)) phoneAttrib.set(lead.phone, {code: lead.code || null, lp});
  else {
    const cur = phoneAttrib.get(lead.phone);
    if (!cur.code && lead.code) cur.code = lead.code;
    if (!cur.lp && lp) cur.lp = lp;
  }
}
const phoneToAccount = {};
for (const a of GF.accounts) {
  const p = normPhone(a.phone_office);
  if (!p) continue;
  if (!phoneToAccount[p] || (+a.total_revenue||0)>(+phoneToAccount[p].total_revenue||0)) phoneToAccount[p]=a;
}
const phonesByCode = new Map();
const leadsByCode = new Map();
for (const lead of SHEET) if (lead.code) leadsByCode.set(lead.code, (leadsByCode.get(lead.code)||0)+1);
for (const [phone, attr] of phoneAttrib) if (attr.code) {
  if (!phonesByCode.has(attr.code)) phonesByCode.set(attr.code, new Set());
  phonesByCode.get(attr.code).add(phone);
}

// Build per-code rows with recovered spend
const allCodes = new Set([...spendByCode.keys(), ...leadsByCode.keys()]);
const rows = [];
for (const code of allCodes) {
  const spendInfo = spendByCode.get(code) || {spend:0, sources:{}};
  const phones = phonesByCode.get(code) || new Set();
  let paid = 0, revenue = 0;
  for (const p of phones) {
    const acct = phoneToAccount[p];
    if (acct && (+acct.total_revenue||0) > 0) { paid++; revenue += +acct.total_revenue; }
  }
  rows.push({
    code,
    spend: spendInfo.spend,
    sources: spendInfo.sources,
    leads: leadsByCode.get(code)||0,
    unique_phones: phones.size,
    paid_phones: paid,
    revenue,
    cpl: leadsByCode.get(code) > 0 ? spendInfo.spend / leadsByCode.get(code) : null,
    cps: paid > 0 ? spendInfo.spend / paid : null,
    roas: spendInfo.spend > 0 ? revenue / spendInfo.spend : null,
  });
}
rows.sort((a,b)=>b.spend-a.spend);

const tot = rows.reduce((a,r)=>({spend:a.spend+r.spend, revenue:a.revenue+r.revenue, leads:a.leads+r.leads, paid:a.paid+r.paid_phones}), {spend:0, revenue:0, leads:0, paid:0});

console.log('=== Recovered attribution summary ===');
console.log(`Total Meta YTD spend:     ${totSpend.toLocaleString()} VND`);
console.log(`  Resolved to a code:     ${(totSpend-totUnresolved).toLocaleString()} (${((totSpend-totUnresolved)/totSpend*100).toFixed(1)}%)`);
console.log(`  Still unresolved:       ${totUnresolved.toLocaleString()} (${(totUnresolved/totSpend*100).toFixed(1)}%)`);
console.log();
console.log(`Total code-attributed revenue (after recovery): ${tot.revenue.toLocaleString()} VND`);
console.log(`Implied Meta ROAS (attributed/attributed):      ${(tot.revenue/(totSpend-totUnresolved)).toFixed(2)}`);

// Write Excel-friendly CSV: 3 sections (high-confidence | mixed-confidence | unresolved)
const COLS = ['Campaign (code)','Spend (VND)','Leads','Unique phones','Paid phones','Revenue (VND)','CPL (VND)','CPS (VND)','ROAS','Source mix','Confidence'];
const esc = s => { const v=String(s); return v.includes(',')||v.includes('"') ? '"'+v.replace(/"/g,'""')+'"' : v; };
const round = v => v==null ? '' : Math.round(v);

function confidence(sources, spend) {
  if (!sources || !spend) return 'no-spend';
  const exactPct = ((sources.exact||0) + (sources['name-variant']||0) + (sources['adset-name']||0)) / spend;
  if (exactPct >= 0.95) return 'high';
  if (exactPct >= 0.5) return 'medium';
  return 'low';
}

const lines = [COLS.join(',')];
for (const r of rows) {
  const conf = confidence(r.sources, r.spend);
  const srcMix = Object.entries(r.sources||{}).map(([s,v])=>`${s}:${(v/r.spend*100).toFixed(0)}%`).join('|') || '';
  lines.push([
    esc(r.code), r.spend, r.leads, r.unique_phones, r.paid_phones, r.revenue,
    round(r.cpl), round(r.cps), r.roas==null?'':r.roas.toFixed(3),
    esc(srcMix), conf,
  ].join(','));
}
lines.push(',,,,,,,,,,');
lines.push([
  `TOTAL — ${rows.length} codes`,
  tot.spend, tot.leads, '', tot.paid, tot.revenue,
  tot.leads>0?Math.round(tot.spend/tot.leads):'',
  tot.paid>0?Math.round(tot.spend/tot.paid):'',
  tot.spend>0?(tot.revenue/tot.spend).toFixed(3):'',
  '', '',
].join(','));

fs.writeFileSync('data/roas-ytd-2026-recovered.csv', '﻿' + lines.join('\r\n') + '\r\n');
console.log();
console.log('Wrote data/roas-ytd-2026-recovered.csv');
