// Append Prior-7d and Last-7d columns to the user's reformatted CSV at
// data/roas-codes-ranked.csv, preserving their existing column layout
// (empty separator columns + comma-formatted numbers in quotes).
//
// Reads .cache/meta_spend_recent.json (2 weeks of weekly-bucketed Meta data)
// and .cache/getfly.json + .cache/sheet_leads.json for revenue side.
import fs from 'node:fs';

const FILE = 'data/roas-codes-ranked.csv';
const RECENT = JSON.parse(fs.readFileSync('.cache/meta_spend_recent.json','utf8'));
const SHEET = JSON.parse(fs.readFileSync('.cache/sheet_leads.json','utf8'));
// Order-based revenue (catches repeat purchases from existing customers,
// which account.created_at cohort filter would miss). Approved status only.
const ORDERS = JSON.parse(fs.readFileSync('.cache/getfly_orders_recent.json','utf8'));

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

// Determine the two week buckets
const weekStarts = [...new Set(RECENT.map(r=>r.date_start || r.date))].sort();
const wLast = weekStarts[weekStarts.length-1];
const wPrior = weekStarts.length >= 2 ? weekStarts[weekStarts.length-2] : null;
const lastStop = RECENT.find(r => (r.date_start||r.date) === wLast)?.date_stop || wLast;
const priorStop = wPrior ? (RECENT.find(r => (r.date_start||r.date) === wPrior)?.date_stop || wPrior) : null;
console.log(`Last week:  ${wLast} → ${lastStop}`);
if (wPrior) console.log(`Prior week: ${wPrior} → ${priorStop}`);

// Per-code spend + registrations per week
const spendLast = new Map(), spendPrior = new Map();
const regsLast = new Map(), regsPrior = new Map();
for (const r of RECENT) {
  const w = r.date_start || r.date;
  const bucket = w === wLast ? 'last' : (w === wPrior ? 'prior' : null);
  if (!bucket) continue;
  const code = resolveAd(r);
  if (!code) continue;
  const sMap = bucket === 'last' ? spendLast : spendPrior;
  const rMap = bucket === 'last' ? regsLast : regsPrior;
  sMap.set(code, (sMap.get(code)||0) + r.spend);
  rMap.set(code, (rMap.get(code)||0) + (r.registrations || 0));
}

// Revenue per code per week — ORDER-based attribution:
//   - Use each approved sale_order's real_amount + created_at
//   - Map order.account_phone → sheet first-touch → code
//   - This correctly captures repeat purchases from existing customers
SHEET.sort((a,b)=>a.date.localeCompare(b.date));
const phoneAttrib = new Map();
for (const l of SHEET) {
  if (!l.phone) continue;
  const lp = lpKey(l.lp_url);
  if (!phoneAttrib.has(l.phone)) phoneAttrib.set(l.phone, {code: l.code || null, lp});
  else { const cur = phoneAttrib.get(l.phone); if (!cur.code && l.code) cur.code = l.code; if (!cur.lp && lp) cur.lp = lp; }
}
const revLast = new Map(), revPrior = new Map();
const inLast = d => d >= wLast && d <= lastStop;
const inPrior = d => wPrior ? (d >= wPrior && d <= priorStop) : false;
let totRevL = 0, totRevP = 0;
let unattrRevL = 0, unattrRevP = 0;
for (const o of ORDERS) {
  if (o.status !== 2) continue; // approved only ("Đã duyệt")
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const d = (o.created_at||'').slice(0,10);
  const window = inLast(d) ? 'last' : (inPrior(d) ? 'prior' : null);
  if (!window) continue;
  if (window === 'last') totRevL += amt; else totRevP += amt;
  const phone = normPhone(o.account_phone);
  const attr = phoneAttrib.get(phone);
  if (!attr || !attr.code) {
    if (window === 'last') unattrRevL += amt; else unattrRevP += amt;
    continue;
  }
  const map = window === 'last' ? revLast : revPrior;
  map.set(attr.code, (map.get(attr.code)||0) + amt);
}

// Match user's number formatting:
//   integer >= 1000 → "1,234,567" (quoted, comma-grouped)
//   integer < 1000 or 0 → bare digits
//   ROAS decimal → raw (3 decimals, drop trailing zeros to match user's style)
//   missing → empty
const fmtN = n => {
  if (n == null) return '';
  const v = Math.round(n);
  if (v === 0) return '0';
  if (Math.abs(v) >= 1000) return '"' + v.toLocaleString('en-US') + '"';
  return String(v);
};
const fmtRoas = (n, d, has) => {
  if (!has) return ''; // no data for this code in this window
  if (d <= 0) return ''; // no spend → can't compute
  const v = n / d;
  // user's csv shows ROAS like "0.498", "0.616", "0", "1.95" — strip trailing zeros after a fractional part but keep at least one digit
  return Number(v.toFixed(3)).toString();
};

// Parse CSV — handle quoted fields with commas
function parseLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else { inQ = false; } }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Read the file, strip BOM
const raw = fs.readFileSync(FILE, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xFEFF;
const text = hasBom ? raw.slice(1) : raw;
const lines = text.split(/\r?\n/).filter(l => l.length > 0);

// Date-range labels for headers (M/D-M/D, e.g. 5/4-5/10).
const md = isoDate => {
  const [, m, d] = isoDate.match(/(\d{2})-(\d{2})$/);
  return `${+m}/${+d}`;
};
const labelP = wPrior ? `${md(wPrior)}-${md(priorStop)}` : 'Prior 7d';
const labelL = `${md(wLast)}-${md(lastStop)}`;

// Header: append the new columns. CPR is the leading indicator (revenue lags
// by days, registrations are immediate) — place it right after spend so it
// reads in funnel order: spend → regs → CPR → rev → ROAS.
const headerExtra = `,,${labelP} spend,${labelP} regs,${labelP} CPR,${labelP} rev,${labelP} ROAS` +
                    `,,${labelL} spend,${labelL} regs,${labelL} CPR,${labelL} rev,${labelL} ROAS`;
const out = [];
out.push(lines[0] + headerExtra);

let codesWithData = 0;
for (let i = 1; i < lines.length; i++) {
  const fields = parseLine(lines[i]);
  const code = fields[0];
  const sPraw = spendPrior.get(code);
  const rPraw = revPrior.get(code);
  const gPraw = regsPrior.get(code);
  const sLraw = spendLast.get(code);
  const rLraw = revLast.get(code);
  const gLraw = regsLast.get(code);
  const hasP = sPraw != null || rPraw != null || gPraw != null;
  const hasL = sLraw != null || rLraw != null || gLraw != null;
  if (hasP || hasL) codesWithData++;
  // when a window has any data, fill missing spend/rev/regs with 0
  const sP = hasP ? (sPraw ?? 0) : null;
  const rP = hasP ? (rPraw ?? 0) : null;
  const gP = hasP ? (gPraw ?? 0) : null;
  const sL = hasL ? (sLraw ?? 0) : null;
  const rL = hasL ? (rLraw ?? 0) : null;
  const gL = hasL ? (gLraw ?? 0) : null;
  // CPR = spend / regs; show as integer (VND per registration). Blank when
  // regs=0 or spend=0.
  const fmtCpr = (spend, regs, has) => {
    if (!has || !spend || !regs) return '';
    return fmtN(spend / regs);
  };
  const extra =
    ',' + ',' + fmtN(sP) + ',' + fmtN(gP) + ',' + fmtCpr(sP, gP, hasP) +
          ',' + fmtN(rP) + ',' + fmtRoas(rP||0, sP||0, hasP) +
    ',' + ',' + fmtN(sL) + ',' + fmtN(gL) + ',' + fmtCpr(sL, gL, hasL) +
          ',' + fmtN(rL) + ',' + fmtRoas(rL||0, sL||0, hasL);
  out.push(lines[i] + extra);
}

const outText = (hasBom ? '﻿' : '') + out.join('\r\n') + '\r\n';
fs.writeFileSync(FILE, outText);

console.log(`\nUpdated ${FILE}: ${lines.length - 1} code rows, ${codesWithData} have last-2-weeks data, ${lines.length - 1 - codesWithData} blank for both weeks (no recent spend)`);

// Totals across all codes — CSV revenue column is the code-attributed subset
const sum = m => [...m.values()].reduce((a,b)=>a+b, 0);
const tSp = sum(spendPrior), tSl = sum(spendLast);
const tRp = sum(revPrior),   tRl = sum(revLast); // code-attributed only
const tGp = sum(regsPrior),  tGl = sum(regsLast);
console.log(`\nCode-attributed rollup (matches the CSV columns):`);
console.log(`  ${labelP}: spend ${Math.round(tSp).toLocaleString()}  regs ${tGp}  CPR ${tGp>0?Math.round(tSp/tGp).toLocaleString():'—'}  rev ${Math.round(tRp).toLocaleString()}  ROAS ${tSp>0?(tRp/tSp).toFixed(2):'—'}`);
console.log(`  ${labelL}: spend ${Math.round(tSl).toLocaleString()}  regs ${tGl}  CPR ${tGl>0?Math.round(tSl/tGl).toLocaleString():'—'}  rev ${Math.round(tRl).toLocaleString()}  ROAS ${tSl>0?(tRl/tSl).toFixed(2):'—'}`);
console.log(`\nFull Getfly revenue (approved orders only, all channels including non-Meta):`);
console.log(`  ${labelP}: total ${Math.round(totRevP).toLocaleString()} VND  (code-attributed ${Math.round(tRp).toLocaleString()} = ${(tRp/totRevP*100).toFixed(0)}%,  unattributed ${Math.round(unattrRevP).toLocaleString()})`);
console.log(`  ${labelL}: total ${Math.round(totRevL).toLocaleString()} VND  (code-attributed ${Math.round(tRl).toLocaleString()} = ${(tRl/totRevL*100).toFixed(0)}%,  unattributed ${Math.round(unattrRevL).toLocaleString()})`);
