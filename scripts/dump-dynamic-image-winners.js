// Extract the 29 dynamic-image ads + flag the top winners,
// so we can brief the user on what's actually working before asking for more inputs.
import fs from 'fs';
const data = JSON.parse(fs.readFileSync('creatives-deep-results.json', 'utf8'));
const di = data.ads
  .filter(a => a.format === 'dynamic-image' && a.objective !== 'OUTCOME_ENGAGEMENT')
  .map(a => ({ ...a, cpr: a.registrations ? a.spend / a.registrations : null }));

console.log('dynamic-image n =', di.length);
const withReg = di.filter(a => a.registrations > 0);
console.log('with reg:', withReg.length, '| zero-reg:', di.length - withReg.length);

console.log('\nTOP 10 dynamic-image by CPR:');
const top = [...withReg].sort((a, b) => a.cpr - b.cpr).slice(0, 10);
for (const a of top) {
  const body = (a.body || a.name || '').replace(/\s+/g, ' ').slice(0, 140);
  console.log(`  CPR ${Math.round(a.cpr).toLocaleString().padStart(10)} | spend ${Math.round(a.spend/1e6)}M | reg ${a.registrations} | ${a.adset_name || ''}`);
  console.log(`     "${body}"`);
}

console.log('\nBOTTOM dynamic-image (zero-reg, highest spend):');
const sinks = di.filter(a => a.registrations === 0).sort((a, b) => b.spend - a.spend).slice(0, 5);
for (const a of sinks) {
  const body = (a.body || a.name || '').replace(/\s+/g, ' ').slice(0, 140);
  console.log(`  spend ${Math.round(a.spend/1e6)}M | impr ${a.impressions?.toLocaleString()} | ${a.adset_name || ''}`);
  console.log(`     "${body}"`);
}

// Available fields on a row (so I know what's queryable)
console.log('\nFIELDS ON A SAMPLE ROW:');
console.log(Object.keys(di[0] || {}).sort());
