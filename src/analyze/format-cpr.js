// CPR by format — does video actually outperform image at scale?
import fs from 'fs';
const data = JSON.parse(fs.readFileSync('creatives-deep-results.json','utf8'));
const ads = data.ads.filter(a => a.objective !== 'OUTCOME_ENGAGEMENT');

function bucket(label, rows) {
  let spend = 0, reg = 0, lpv = 0, n = 0, zero = 0, impr = 0, clicks = 0;
  const cprs = [];
  for (const r of rows) {
    spend += r.spend; reg += r.registrations; lpv += r.lpv;
    impr += r.impressions; clicks += r.link_clicks;
    n += 1;
    if (r.registrations === 0) zero += 1;
    if (r.registrations > 0) cprs.push(r.spend / r.registrations);
  }
  cprs.sort((a,b) => a-b);
  const median = cprs.length ? cprs[Math.floor(cprs.length/2)] : null;
  const p25 = cprs.length ? cprs[Math.floor(cprs.length*0.25)] : null;
  const p75 = cprs.length ? cprs[Math.floor(cprs.length*0.75)] : null;
  console.log(`\n${label}  (n=${n})`);
  console.log(`  spend ${Math.round(spend/1e6)}M VND | reg ${reg} | blended CPR ${reg ? Math.round(spend/reg).toLocaleString() : 'n/a'} VND`);
  console.log(`  median CPR ${median ? Math.round(median).toLocaleString() : 'n/a'} | p25 ${p25 ? Math.round(p25).toLocaleString() : 'n/a'} | p75 ${p75 ? Math.round(p75).toLocaleString() : 'n/a'}`);
  console.log(`  zero-reg ${zero}/${n} (${Math.round(100*zero/n)}%) | CTR ${impr ? (100*clicks/impr).toFixed(2) : 'n/a'}% | LPV→reg ${lpv ? (100*reg/lpv).toFixed(1) : 'n/a'}%`);
}

const fmts = ['video','dynamic-image','photo','boosted-post'];
console.log('=== ALL ADS BY FORMAT (last_90d, SALES, spend ≥ 1M VND) ===');
for (const f of fmts) bucket(f.toUpperCase(), ads.filter(a => a.format === f));

console.log('\n\n=== HIGH-SPEND ONLY (≥3M VND) — fairer comparison ===');
const high = ads.filter(a => a.spend >= 3_000_000);
for (const f of fmts) bucket(f.toUpperCase(), high.filter(a => a.format === f));

console.log('\n\n=== TOP-15-BY-CPR FORMAT MIX ===');
const top = [...ads].filter(a => a.registrations > 0).map(a => ({...a, cpr: a.spend/a.registrations})).sort((a,b)=>a.cpr-b.cpr).slice(0,15);
const mix = {};
for (const a of top) mix[a.format] = (mix[a.format]||0)+1;
console.log(mix);

console.log('\n\n=== BOTTOM-15-BY-CPR FORMAT MIX (with reg) ===');
const bot = [...ads].filter(a => a.registrations > 0).map(a => ({...a, cpr: a.spend/a.registrations})).sort((a,b)=>b.cpr-a.cpr).slice(0,15);
const mix2 = {};
for (const a of bot) mix2[a.format] = (mix2[a.format]||0)+1;
console.log(mix2);

console.log('\n\n=== ZERO-REG (sinks) BY FORMAT ===');
const zero = ads.filter(a => a.registrations === 0);
const zmix = {};
let zspend = {};
for (const a of zero) { zmix[a.format]=(zmix[a.format]||0)+1; zspend[a.format]=(zspend[a.format]||0)+a.spend; }
for (const f of fmts) console.log(`  ${f}: ${zmix[f]||0} ads, ${Math.round((zspend[f]||0)/1e6)}M VND wasted`);
