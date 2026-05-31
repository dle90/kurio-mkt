// v2 (local, no API): join per-code ROAS to LP via the body-text URL (rich
// coverage; validated accurate against the 11 re-fetched links). Also exposes
// the within-(concept,LP) ROAS spread so we can see if freshness noise swamps
// any LP signal.
const fs = require('fs');
const WIN = JSON.parse(fs.readFileSync('data/code-roas-window.json', 'utf8'));
const CREA = JSON.parse(fs.readFileSync('.cache/meta_creative.json', 'utf8'));

let CODES = null;
for (const v of Object.values(WIN)) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const f = Object.values(v)[0];
    if (f && typeof f === 'object' && 'roas' in f && 'spend' in f) { CODES = v; break; }
  }
}
const norm = s => (s || '').toLowerCase().trim();
const pathOf = u => { const m = u && u.match(/https?:\/\/([a-z0-9.]*kurio\.vn)(\/[a-z0-9_-]*)/i); return m ? (m[1] + m[2]).toLowerCase().replace(/\/+$/, '') : null; };

// code -> body-URL LP votes (match ad_name_norm to code, fuzzy on _/-)
const variants = c => new Set([c, c.replace(/_/g, '-'), c.replace(/-/g, '_')]);
const adByName = new Map();
for (const a of CREA) { const k = norm(a.ad_name_norm || a.ad_name); if (k) (adByName.get(k) || adByName.set(k, []).get(k)).push(a); }

function lpForCode(code) {
  const votes = {};
  for (const v of variants(norm(code))) for (const a of (adByName.get(v) || [])) {
    const lp = pathOf(a.creative?.body || '');
    if (lp) votes[lp] = (votes[lp] || 0) + 1;
  }
  const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return { lp: top ? top[0] : null, votes };
}

const concept = code => {
  let c = code.toLowerCase().replace(/[-_]?(reup|xpage[-_]?kv|xpage|xp[-_]?5|xp|kv)\b/g, '');
  return (c.replace(/^code/, '').replace(/[-_]+$/, '')) || code;
};

const MIN = 2_000_000;
const rows = [];
for (const [code, v] of Object.entries(CODES)) {
  if (v.spend < MIN || v.roas == null) continue;
  const { lp } = lpForCode(code);
  rows.push({ code, concept: concept(code), lp, spend: v.spend, reg: v.reg, rev: v.rev, roas: v.roas });
}
const resolved = rows.filter(r => r.lp);
const fmt = n => Math.round(n).toLocaleString('en-US');
const r2 = n => n == null ? '—' : n.toFixed(2);

console.log(`Codes spend>=${fmt(MIN)}: ${rows.length}  | with LP from body URL: ${resolved.length}\n`);

console.log('=== LP-level (spend-weighted ROAS) ===');
const lpAgg = {};
for (const r of resolved) { const a = lpAgg[r.lp] = lpAgg[r.lp] || { n: 0, spend: 0, rev: 0 }; a.n++; a.spend += r.spend; a.rev += r.rev; }
for (const [lp, a] of Object.entries(lpAgg).sort((x, y) => y[1].spend - x[1].spend))
  console.log(`  ${lp.padEnd(42)} codes=${String(a.n).padStart(3)} spend=${fmt(a.spend).padStart(12)} ROAS=${r2(a.spend ? a.rev / a.spend : null)}`);

console.log('\n=== concept × LP (only concepts on >1 LP — interaction observable) ===');
const byC = {};
for (const r of resolved) (byC[r.concept] = byC[r.concept] || []).push(r);
let nMulti = 0;
for (const [c, rs] of Object.entries(byC)) {
  const lps = [...new Set(rs.map(r => r.lp))];
  if (lps.length < 2) continue;
  nMulti++;
  console.log(`\nconcept "${c}":`);
  for (const lp of lps) {
    const cell = rs.filter(r => r.lp === lp);
    const spend = cell.reduce((s, r) => s + r.spend, 0), rev = cell.reduce((s, r) => s + r.rev, 0);
    const spread = cell.map(r => `${r.code}=${r2(r.roas)}`).join(', ');
    console.log(`   ${lp.padEnd(40)} spend=${fmt(spend).padStart(11)} ROAS=${r2(spend ? rev / spend : null)}   [${spread}]`);
  }
}
console.log(`\nMulti-LP concepts: ${nMulti}`);
fs.writeFileSync('.cache/lp_matrix_v2.json', JSON.stringify({ rows, lpAgg }, null, 2));
