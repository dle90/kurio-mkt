// Re-up lift analysis. Question: does re-upping a creative reliably lift ROAS,
// and how fast does the lift decay? Sets the new-content : re-up ratio.
// Sources (local, no API):
//   data/creative-deep-dive.json  -> top_codes (window_roas, apr_may_roas, trajectory, age_median_d, window_spend)
//   data/code-roas-window.json    -> full per-code {spend,reg,rev,roas} (broader n for the reup-vs-non population cut)
const fs = require('fs');
const DD = JSON.parse(fs.readFileSync('data/creative-deep-dive.json', 'utf8'));
const WIN = JSON.parse(fs.readFileSync('data/code-roas-window.json', 'utf8'));

let CODES = null;
for (const v of Object.values(WIN)) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const f = Object.values(v)[0];
    if (f && typeof f === 'object' && 'roas' in f && 'spend' in f) { CODES = v; break; }
  }
}
const isReup = c => /(^|[-_ ])reup\b/i.test(c) || /bản ?sao/i.test(c);
const concept = c => {
  let x = c.toLowerCase().replace(/[-_]?(reup|xpage[-_]?kv|xpage|xp[-_]?5|xp|kv|x3)\b/g, '');
  return (x.replace(/^code/, '').replace(/[-_ ]+$/, '')) || c;
};
const r2 = n => n == null || !isFinite(n) ? '—' : n.toFixed(2);
const fmt = n => Math.round(n).toLocaleString('en-US');
const wmean = (arr, val, w) => { let s = 0, ws = 0; for (const x of arr) { s += val(x) * w(x); ws += w(x); } return ws ? s / ws : null; };
const mean = (arr, val) => arr.length ? arr.reduce((s, x) => s + val(x), 0) / arr.length : null;
const median = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const TC = DD.top_codes || [];
console.log(`deep-dive top_codes: ${TC.length}  |  code-roas-window codes: ${Object.keys(CODES).length}\n`);

// ---- CUT A: re-up vs aged-original, paired within a concept (from code-roas-window, broad) ----
const rowsW = Object.entries(CODES).filter(([c, v]) => v.spend >= 1_000_000 && v.roas != null)
  .map(([c, v]) => ({ code: c, concept: concept(c), reup: isReup(c), ...v }));
const byConcept = {};
for (const r of rowsW) (byConcept[r.concept] = byConcept[r.concept] || []).push(r);

console.log('=== CUT A — re-up vs non-reup, paired within the same concept (spend-weighted ROAS) ===');
console.log('concept           reup_ROAS (codes)                         | non-reup_ROAS (codes)                     | lift');
const pairLifts = [];
for (const [c, rs] of Object.entries(byConcept)) {
  const rp = rs.filter(r => r.reup), np = rs.filter(r => !r.reup);
  if (!rp.length || !np.length) continue;
  const rRoas = wmean(rp, x => x.roas, x => x.spend), nRoas = wmean(np, x => x.roas, x => x.spend);
  const lift = rRoas - nRoas;
  pairLifts.push({ concept: c, rRoas, nRoas, lift });
  const fa = a => a.map(x => `${x.code}=${r2(x.roas)}`).join(',');
  console.log(`${c.padEnd(16)} ${r2(rRoas).padStart(5)} (${fa(rp)})`.padEnd(60) + ` | ${r2(nRoas).padStart(5)} (${fa(np)})`.padEnd(46) + ` | ${lift >= 0 ? '+' : ''}${r2(lift)}`);
}
console.log(`\nPaired concepts: ${pairLifts.length} | mean lift (reup - nonreup): ${r2(mean(pairLifts, x => x.lift))} | median: ${r2(median(pairLifts.map(x => x.lift)))}`);
console.log(`reup>nonreup in ${pairLifts.filter(x => x.lift > 0).length}/${pairLifts.length} concepts`);

// ---- CUT B: population — all reup codes vs all non-reup codes ----
const rp = rowsW.filter(r => r.reup), np = rowsW.filter(r => !r.reup);
console.log('\n=== CUT B — population (all codes spend>=1M) ===');
console.log(`reup codes:     n=${rp.length}  spend=${fmt(rp.reduce((s, x) => s + x.spend, 0))}  spend-wtd ROAS=${r2(wmean(rp, x => x.roas, x => x.spend))}  mean ROAS=${r2(mean(rp, x => x.roas))}`);
console.log(`non-reup codes: n=${np.length}  spend=${fmt(np.reduce((s, x) => s + x.spend, 0))}  spend-wtd ROAS=${r2(wmean(np, x => x.roas, x => x.spend))}  mean ROAS=${r2(mean(np, x => x.roas))}`);

// ---- CUT C: freshness -> ROAS (deep-dive top_codes have age + trajectory) ----
const tc = TC.filter(t => t.window_roas != null && t.age_median_d != null && t.window_spend >= 1_000_000);
const buckets = [[0, 20], [20, 35], [35, 60], [60, 9999]];
console.log('\n=== CUT C — freshness (age_median_d) -> ROAS (deep-dive codes, spend>=1M) ===');
console.log('age bucket(d)   n   spend         spend-wtd ROAS   median trajectory(window-apr/may)');
for (const [lo, hi] of buckets) {
  const b = tc.filter(t => t.age_median_d >= lo && t.age_median_d < hi);
  if (!b.length) continue;
  console.log(`${(lo + '-' + (hi === 9999 ? '+' : hi)).padEnd(14)} ${String(b.length).padStart(2)}  ${fmt(b.reduce((s, x) => s + x.window_spend, 0)).padStart(12)}   ${r2(wmean(b, x => x.window_roas, x => x.window_spend)).padStart(6)}          ${r2(median(b.map(x => x.trajectory ?? (x.window_roas - (x.apr_may_roas ?? x.window_roas)))))}`);
}
// correlation age vs window_roas
const xs = tc.map(t => t.age_median_d), ys = tc.map(t => t.window_roas);
const mx = mean(tc, t => t.age_median_d), my = mean(tc, t => t.window_roas);
let cov = 0, vx = 0, vy = 0;
for (let i = 0; i < tc.length; i++) { cov += (xs[i] - mx) * (ys[i] - my); vx += (xs[i] - mx) ** 2; vy += (ys[i] - my) ** 2; }
console.log(`Pearson r(age_median_d, window_roas) = ${r2(cov / Math.sqrt(vx * vy))}  (n=${tc.length})`);

// ---- CUT D: trajectory by reup status (are reups rising vs non-reups fading?) ----
const tcReup = tc.filter(t => isReup(t.code)), tcNon = tc.filter(t => !isReup(t.code));
const traj = t => t.trajectory ?? (t.window_roas - (t.apr_may_roas ?? t.window_roas));
console.log('\n=== CUT D — trajectory (window ROAS - Apr/May ROAS) by re-up status ===');
console.log(`reup codes:     n=${tcReup.length}  mean trajectory=${r2(mean(tcReup, traj))}  rising(>0): ${tcReup.filter(t => traj(t) > 0).length}/${tcReup.length}`);
console.log(`non-reup codes: n=${tcNon.length}  mean trajectory=${r2(mean(tcNon, traj))}  rising(>0): ${tcNon.filter(t => traj(t) > 0).length}/${tcNon.length}`);
console.log('\nreup codes detail (code | age_med | apr/may ROAS -> window ROAS | trajectory):');
for (const t of tcReup.sort((a, b) => b.window_spend - a.window_spend))
  console.log(`  ${t.code.padEnd(16)} age=${String(t.age_median_d).padStart(3)}d  ${r2(t.apr_may_roas).padStart(5)} -> ${r2(t.window_roas).padStart(5)}   ${traj(t) >= 0 ? '+' : ''}${r2(traj(t))}`);
