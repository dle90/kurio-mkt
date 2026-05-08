// Quick sampler — print full body of top performers, bottom performers, and one ad per format/persona.
import fs from 'fs';
const data = JSON.parse(fs.readFileSync('creatives-deep-results.json','utf8'));
const ads = data.ads.filter(a => a.objective !== 'OUTCOME_ENGAGEMENT' && a.registrations > 0)
  .map(a => ({...a, cpr: a.spend / a.registrations}));

function head(a) { return (a.body || '').split('\n')[0]?.slice(0,120); }
function show(a, label) {
  console.log(`\n--- ${label} ---`);
  console.log(`[${a.account}] ${a.ad_name}`);
  console.log(`  campaign: ${a.campaign}  adset: ${a.adset}`);
  console.log(`  spend ${Math.round(a.spend).toLocaleString()} | reg ${a.registrations} | CPR ${Math.round(a.cpr).toLocaleString()} | format ${a.format} | CTA ${a.cta}`);
  console.log(`  HEAD: ${head(a)}`);
  if (a.title) console.log(`  TITLE: ${a.title}`);
  console.log(`  BODY (${(a.body||'').length} ch):`);
  console.log((a.body || '').replace(/\n+/g,'\n  ').slice(0, 1200));
}

const sortedByCpr = [...ads].sort((a,b) => a.cpr - b.cpr);
console.log('\n========== TOP 12 BY CPR ==========');
sortedByCpr.slice(0,12).forEach((a,i) => show(a, `TOP #${i+1}`));

console.log('\n========== BOTTOM 8 BY CPR (with ≥3 reg) ==========');
const decent = sortedByCpr.filter(a => a.registrations >= 3);
decent.slice(-8).forEach((a,i) => show(a, `BOTTOM #${i+1}`));

console.log('\n========== HIGHEST-SPEND ZERO-REG ==========');
const zero = data.ads.filter(a => a.objective !== 'OUTCOME_ENGAGEMENT' && a.registrations === 0)
  .sort((a,b) => b.spend - a.spend).slice(0,5);
zero.forEach((a,i) => show(a, `ZERO-REG #${i+1}`));
