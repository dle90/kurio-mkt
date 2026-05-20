// Shared attribution — Getfly ads_code based. Single source of truth for
// code resolution (Meta campaign name -> code) and phone -> code, used by
// every ROAS report so the pipeline stays consistent.
//
// Mirrors the ATTRIB=getfly path of recompute_codes_ranked.js.
import fs from 'node:fs';

export function normPhone(s) {
  if (!s) return '';
  const d = String(s).replace(/[^\d]/g, '');
  if (d.startsWith('84') && (d.length === 11 || d.length === 12)) return '0' + d.slice(2);
  if (d.length === 9) return '0' + d;
  if (d.length === 10 && d.startsWith('0')) return d;
  if (d.length === 10) return '0' + d.slice(1);
  return d;
}

export const isXpage = code => /-?xpage|_xpage|-xp\b|-xp-|-kv$/i.test(code || '');

function variants(s) {
  if (!s) return new Set();
  const lc = s.trim().toLowerCase();
  const vs = new Set([lc, lc.replace(/\s+/g, ''), lc.replace(/[\s_\-]+/g, '')]);
  if (/^\d+$/.test(lc)) vs.add('code' + lc);
  if (/^\d+/.test(lc)) { vs.add('code' + lc.replace(/\s+/g, '')); vs.add('code' + lc.replace(/[\s_\-]+/g, '')); }
  if (lc.startsWith('code')) vs.add(lc.slice(4));
  const m = lc.match(/^([a-z]+)\s*-\s*(\d+)$/);
  if (m) { vs.add(m[1] + m[2]); vs.add(m[1] + '-' + m[2]); vs.add('code' + m[2]); }
  return vs;
}

// Returns { codeSet, phoneToCode, resolveAd, accounts }
export function loadAttribution() {
  const accounts = JSON.parse(fs.readFileSync('.cache/getfly_accounts.json', 'utf8'));

  // Code set — distinct ads_code values (lowercased).
  const codeSet = new Set();
  for (const a of accounts) if (a.ads_code) codeSet.add(a.ads_code.trim().toLowerCase());

  // phone -> code, first-touch (earliest-created account that carries a code).
  const phoneToCode = new Map();
  const sorted = [...accounts].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  for (const a of sorted) {
    if (!a.phone || !a.ads_code) continue;
    if (!phoneToCode.has(a.phone)) phoneToCode.set(a.phone, a.ads_code.trim().toLowerCase());
  }

  const findMatch = s => {
    if (!s) return null;
    for (const v of variants(s)) if (codeSet.has(v)) return v;
    return null;
  };
  // r: { ad_name_norm, adset_name, campaign_name }
  const resolveAd = r => {
    if (codeSet.has(r.ad_name_norm)) return r.ad_name_norm;
    let m = findMatch(r.ad_name_norm); if (m) return m;
    m = findMatch(r.adset_name); if (m) return m;
    for (const t of String(r.adset_name || '').split(/[+_,\s\\\/]/).map(x => x.trim()).filter(Boolean)) {
      const mm = findMatch(t); if (mm) return mm;
    }
    for (const t of String(r.campaign_name || '').split(/[+_,\s\\\/\-]/).map(x => x.trim()).filter(t => t && t.length >= 2)) {
      const mm = findMatch(t); if (mm) return mm;
    }
    return null;
  };

  return { codeSet, phoneToCode, resolveAd, accounts };
}
