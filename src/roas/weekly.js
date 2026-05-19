// Last-week vs prior-week ROAS by code family.
// Spend:   .cache/meta_spend_recent.json (14d daily) → split into two 7d windows
// Revenue: phones whose Getfly account created_at falls in each 7d window
// CAVEAT: revenue lags spend — people who click this week may not pay this week.
//         Both windows are equally lagged, so the WOW delta is meaningful even
//         if absolute ROAS is understated.
import fs from 'node:fs';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend_recent.json','utf8'));
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
function familyOf(code) {
  if (!code) return code;
  let s = code;
  const sfx = [/-\d+$/, /-reup$/, /-xp$/, /-xpage$/, /-xpage-kv$/, /-tg$/, /-x3$/, /-x$/, /-kv$/, /_xpage$/, /_kv$/, /-5$/, /_\d+$/];
  let changed = true;
  while (changed) { changed = false; for (const f of sfx) if (f.test(s)) { s = s.replace(f,''); changed = true; break; } }
  return s;
}

// Two windows from weekly-aggregated Meta rows. Each ad has up to 2 rows,
// keyed by date_start (week-start). Determine which is "last" vs "prior".
const dayMs = 24*60*60*1000;
const weekStarts = [...new Set(META.map(r=>r.date_start || r.date))].sort();
const wLast = weekStarts[weekStarts.length-1];
const wPrior = weekStarts.length >= 2 ? weekStarts[weekStarts.length-2] : null;
const lastStop = META.find(r => (r.date_start||r.date) === wLast)?.date_stop || wLast;
const priorStop = wPrior ? (META.find(r => (r.date_start||r.date) === wPrior)?.date_stop || wPrior) : null;
console.log(`Last week:  ${wLast} → ${lastStop}`);
if (wPrior) console.log(`Prior week: ${wPrior} → ${priorStop}`);
else console.log('(no prior-week data — only one week returned)');

const inLast = d => d >= wLast && d <= lastStop;
const inPrior = d => wPrior ? (d >= wPrior && d <= priorStop) : false;
const weekOf = r => (r.date_start || r.date);

// Aggregate spend per code family for each window
const spendLast = new Map(), spendPrior = new Map();
let unresolvedLast = 0, unresolvedPrior = 0;
for (const r of META) {
  const w = weekOf(r);
  const bucket = w === wLast ? 'last' : (w === wPrior ? 'prior' : null);
  if (!bucket) continue;
  const code = resolveAd(r);
  if (!code) { if (bucket === 'last') unresolvedLast += r.spend; else unresolvedPrior += r.spend; continue; }
  const map = bucket === 'last' ? spendLast : spendPrior;
  // Per-code now (no family grouping) per user request
  map.set(code, (map.get(code)||0) + r.spend);
}

// Revenue per family per window — Getfly account.created_at within window
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
const revLast = new Map(), revPrior = new Map();
for (const [phone, attr] of phoneAttrib) {
  if (!attr.code) continue;
  const acct = phoneToAccount[phone];
  if (!acct || (+acct.total_revenue||0) <= 0) continue;
  const acctDate = (acct.created_at||'').slice(0,10);
  if (!acctDate) continue;
  if (inLast(acctDate)) revLast.set(attr.code, (revLast.get(attr.code)||0) + (+acct.total_revenue||0));
  else if (inPrior(acctDate)) revPrior.set(attr.code, (revPrior.get(attr.code)||0) + (+acct.total_revenue||0));
}

// Build per-code rows
const isXpage = code => /-?xpage|_xpage|-xp\b|-xp-|-kv$/i.test(code || '');
const codes = new Set([...spendLast.keys(), ...spendPrior.keys(), ...revLast.keys(), ...revPrior.keys()]);
const rows = [];
let totSpendL=0,totSpendP=0,totRevL=0,totRevP=0;
for (const code of codes) {
  const sL = spendLast.get(code)||0, sP = spendPrior.get(code)||0;
  const rL = revLast.get(code)||0,   rP = revPrior.get(code)||0;
  if (sL===0 && sP===0 && rL===0 && rP===0) continue;
  rows.push({
    code, is_xpage: isXpage(code),
    spendPrior: sP, revPrior: rP, roasPrior: sP>0 ? rP/sP : null,
    spendLast: sL,  revLast: rL,  roasLast: sL>0 ? rL/sL : null,
    spendDelta: sL - sP,
    roasDelta: (sL>0?rL/sL:null) != null && (sP>0?rP/sP:null) != null ? (rL/sL - rP/sP) : null,
  });
  totSpendL+=sL; totSpendP+=sP; totRevL+=rL; totRevP+=rP;
}
rows.sort((a,b)=>b.spendLast-a.spendLast);

const esc = s => { const v=String(s); return v.includes(',')||v.includes('"') ? '"'+v.replace(/"/g,'""')+'"' : v; };
const lines = ['Code,is_xpage,Prior 7d spend,Prior 7d rev,Prior 7d ROAS,Last 7d spend,Last 7d rev,Last 7d ROAS,Spend Δ,ROAS Δ'];
for (const r of rows) {
  lines.push([
    esc(r.code), r.is_xpage ? 'TRUE' : 'FALSE',
    Math.round(r.spendPrior), Math.round(r.revPrior), r.roasPrior==null?'':r.roasPrior.toFixed(3),
    Math.round(r.spendLast),  Math.round(r.revLast),  r.roasLast==null?'':r.roasLast.toFixed(3),
    Math.round(r.spendDelta),
    r.roasDelta==null?'':r.roasDelta.toFixed(3),
  ].join(','));
}
lines.push([
  'TOTAL',
  Math.round(totSpendP), Math.round(totRevP), totSpendP>0?(totRevP/totSpendP).toFixed(3):'',
  Math.round(totSpendL), Math.round(totRevL), totSpendL>0?(totRevL/totSpendL).toFixed(3):'',
  Math.round(totSpendL - totSpendP),
  (totSpendL>0 && totSpendP>0) ? (totRevL/totSpendL - totRevP/totSpendP).toFixed(3) : '',
].join(','));
fs.writeFileSync('data/roas-weekly-wow.csv', '﻿' + lines.join('\r\n') + '\r\n');

console.log(`\nUnresolved spend — last 7d: ${unresolvedLast.toLocaleString()} VND, prior 7d: ${unresolvedPrior.toLocaleString()} VND`);
console.log(`\nWeekly totals:`);
console.log(`Prior 7d:  spend ${Math.round(totSpendP).toLocaleString()}  rev ${Math.round(totRevP).toLocaleString()}  ROAS ${totSpendP>0?(totRevP/totSpendP).toFixed(2):'—'}`);
console.log(`Last 7d:   spend ${Math.round(totSpendL).toLocaleString()}  rev ${Math.round(totRevL).toLocaleString()}  ROAS ${totSpendL>0?(totRevL/totSpendL).toFixed(2):'—'}`);
const dSpend = totSpendL - totSpendP;
console.log(`Δ spend:   ${(dSpend>=0?'+':'')}${dSpend.toLocaleString()}  (${((dSpend/totSpendP)*100).toFixed(0)}%)`);

console.log('\nTop 20 codes by last-7d spend:');
console.log('xp? ' + 'code'.padEnd(22) + ' P7 spend'.padStart(13) + ' P7 ROAS  ' + 'L7 spend'.padStart(13) + ' L7 ROAS    Δ ROAS');
for (const r of rows.slice(0,20)) {
  console.log(
    (r.is_xpage?'XP ':'   ') +
    r.code.slice(0,21).padEnd(22) +
    Math.round(r.spendPrior).toLocaleString().padStart(12) +
    (r.roasPrior==null?'    —':r.roasPrior.toFixed(2)).padStart(8) + '   ' +
    Math.round(r.spendLast).toLocaleString().padStart(11) +
    (r.roasLast==null?'    —':r.roasLast.toFixed(2)).padStart(8) +
    (r.roasDelta==null?'      —':(r.roasDelta>=0?'   +':'   ')+r.roasDelta.toFixed(2)).padStart(11)
  );
}

// Xpage vs non-xpage rollup
const xp = rows.filter(r=>r.is_xpage), nxp = rows.filter(r=>!r.is_xpage);
const xpL = xp.reduce((a,r)=>({s:a.s+r.spendLast,  r:a.r+r.revLast}),  {s:0,r:0});
const xpP = xp.reduce((a,r)=>({s:a.s+r.spendPrior, r:a.r+r.revPrior}), {s:0,r:0});
const nxpL = nxp.reduce((a,r)=>({s:a.s+r.spendLast,  r:a.r+r.revLast}),  {s:0,r:0});
const nxpP = nxp.reduce((a,r)=>({s:a.s+r.spendPrior, r:a.r+r.revPrior}), {s:0,r:0});
console.log('\nXPAGE vs non-XPAGE:');
console.log(`  XPAGE     P7: spend ${Math.round(xpP.s).toLocaleString()}  rev ${Math.round(xpP.r).toLocaleString()}  ROAS ${xpP.s>0?(xpP.r/xpP.s).toFixed(2):'—'}`);
console.log(`            L7: spend ${Math.round(xpL.s).toLocaleString()}  rev ${Math.round(xpL.r).toLocaleString()}  ROAS ${xpL.s>0?(xpL.r/xpL.s).toFixed(2):'—'}`);
console.log(`  Non-XPAGE P7: spend ${Math.round(nxpP.s).toLocaleString()}  rev ${Math.round(nxpP.r).toLocaleString()}  ROAS ${nxpP.s>0?(nxpP.r/nxpP.s).toFixed(2):'—'}`);
console.log(`            L7: spend ${Math.round(nxpL.s).toLocaleString()}  rev ${Math.round(nxpL.r).toLocaleString()}  ROAS ${nxpL.s>0?(nxpL.r/nxpL.s).toFixed(2):'—'}`);
console.log('\nWrote data/roas-weekly-wow.csv');
