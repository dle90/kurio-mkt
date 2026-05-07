// J — Re-test the original 11× same-creative CPR finding controlling for ad-life month.
// For each of the 5 campaigns running the "TỪ HỌC SINH SUÝT Ở LẠI LỚP" body,
// pull each ad set's monthly CPR series since its own creation_time, then
// compare the spread of first-month CPRs (when the adset was still fresh)
// against the spread of later-month CPRs.
//
// If the first-month spread is much smaller than the lifetime spread, fatigue
// explains the original 11× finding. If it's still ~11×, targeting is real.
import { writeFileSync } from 'node:fs';
import { meta } from '../client.js';

const CAMPAIGNS = [
  { account: 'act_930175825635997', name: 'CVS_TUANTA_CODE83_xpage_kv', original_tier: 'TOP', original_cpr_vnd: 96517 },
  { account: 'act_1071893357737329', name: 'CVS_TUANTA_25/07_CODE83+84_Xpage', original_tier: 'TOP', original_cpr_vnd: 134292 },
  { account: 'act_1071893357737329', name: 'CVS_TUANTA_05/01_CODE83+84 - Bản sao 2', original_tier: 'TOP', original_cpr_vnd: 170542 },
  { account: 'act_1071893357737329', name: 'CVS_TUANTA_05/01_CODE83+84 - TG - Bản sao', original_tier: 'BOTTOM', original_cpr_vnd: 1098449 },
  { account: 'act_930175825635997', name: 'CVS_TUANTA_04/08_CODE81+83+84_TG - LT - Bản sao 4', original_tier: 'BOTTOM', original_cpr_vnd: 1064164 },
];

function actionValue(actions, type) {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

const TODAY = new Date().toISOString().slice(0, 10);

const all = [];
for (const c of CAMPAIGNS) {
  console.log(`Resolving ${c.name} on ${c.account}...`);
  const camps = await meta.getAll(`/${c.account}/campaigns`, { fields: 'id,name', limit: 200 });
  const camp = camps.find(x => x.name === c.name);
  if (!camp) { console.log(`  NOT FOUND`); continue; }

  const adsets = await meta.getAll(`/${camp.id}/adsets`, {
    fields: 'id,name,effective_status,created_time,start_time',
    limit: 50,
  });
  console.log(`  ${adsets.length} adset(s)`);

  for (const a of adsets) {
    // Pull monthly insights since the adset was created (or since 2025-10-01, whichever later).
    const since = a.created_time.slice(0, 10) > '2025-10-01' ? a.created_time.slice(0, 10) : '2025-10-01';
    if (since >= TODAY) continue;
    let series = [];
    try {
      const rows = await meta.getAll(`/${a.id}/insights`, {
        time_increment: 30,
        time_range: { since, until: TODAY },
        fields: 'date_start,date_stop,spend,impressions,actions',
      });
      series = rows.map((r, idx) => {
        const reg = actionValue(r.actions, 'complete_registration');
        const spend = Number(r.spend) || 0;
        return {
          life_month: idx + 1,
          period_start: r.date_start,
          period_end: r.date_stop,
          spend,
          reg,
          cpr: reg > 0 ? spend / reg : null,
        };
      });
    } catch (e) {
      console.log(`    ${a.id} insights failed: ${e.message}`);
    }
    all.push({
      campaign: c.name,
      account: c.account.endsWith('1071893357737329') ? 'Kurio 2' : 'Kurio 3',
      original_tier: c.original_tier,
      original_campaign_cpr_vnd: c.original_cpr_vnd,
      adset_id: a.id,
      adset_name: a.name,
      adset_status: a.effective_status,
      created_time: a.created_time,
      adset_age_days: daysBetween(a.created_time, TODAY),
      series,
      first_month: series[0] || null,
      lifetime_spend: series.reduce((s, r) => s + r.spend, 0),
      lifetime_reg: series.reduce((s, r) => s + r.reg, 0),
    });
  }
}

for (const r of all) {
  r.lifetime_cpr = r.lifetime_reg > 0 ? r.lifetime_spend / r.lifetime_reg : null;
}

console.log(`\n${'='.repeat(140)}`);
console.log(`Same-creative ad sets — monthly CPR trajectory by ad-set life month`);
console.log(`${'='.repeat(140)}\n`);

for (const r of all) {
  const trajStr = r.series.map(s => {
    if (s.reg === 0 && s.spend > 0) return `m${s.life_month}: 0reg/${Math.round(s.spend/1000)}k`;
    if (s.cpr) return `m${s.life_month}: ${Math.round(s.cpr).toLocaleString()} (${s.reg})`;
    return `m${s.life_month}: -`;
  }).join('  ');
  console.log(`[${r.original_tier}] ${r.account} — ${r.campaign}`);
  console.log(`  adset: ${r.adset_name} | created ${r.created_time.slice(0, 10)} | age ${r.adset_age_days}d | ${r.adset_status}`);
  console.log(`  lifetime: spend=${Math.round(r.lifetime_spend).toLocaleString()} reg=${r.lifetime_reg} CPR=${r.lifetime_cpr ? Math.round(r.lifetime_cpr).toLocaleString() : '-'}`);
  console.log(`  trajectory: ${trajStr}`);
  console.log();
}

console.log(`${'='.repeat(140)}`);
console.log(`First-month CPR comparison (controlled for fatigue)`);
console.log(`${'='.repeat(140)}\n`);

const firstMonthRows = all
  .filter(r => r.first_month && r.first_month.cpr)
  .sort((a, b) => a.first_month.cpr - b.first_month.cpr);

console.table(firstMonthRows.map(r => ({
  tier: r.original_tier,
  account: r.account,
  adset: r.adset_name?.slice(0, 30),
  first_month_period: `${r.first_month.period_start}→${r.first_month.period_end}`,
  first_month_cpr: Math.round(r.first_month.cpr).toLocaleString(),
  first_month_reg: r.first_month.reg,
  age_at_first: 'm1',
  lifetime_cpr: r.lifetime_cpr ? Math.round(r.lifetime_cpr).toLocaleString() : '-',
})));

const fmCprs = firstMonthRows.map(r => r.first_month.cpr);
const lifeCprs = all.filter(r => r.lifetime_cpr).map(r => r.lifetime_cpr);
function spread(arr) {
  if (arr.length < 2) return null;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  return { min: Math.round(min), max: Math.round(max), spread_x: (max / min).toFixed(2) };
}

console.log(`\nFirst-month CPR spread:  ${JSON.stringify(spread(fmCprs))}`);
console.log(`Lifetime CPR spread:     ${JSON.stringify(spread(lifeCprs))}`);
console.log(`Original analysis spread (last_90d, lifetime-ish): ~11×`);

console.log(`\nInterpretation:`);
console.log(`  If first-month spread << lifetime spread → fatigue explained the original finding.`);
console.log(`  If first-month spread ≈ lifetime spread  → targeting is the real driver, fatigue is independent.`);

writeFileSync('same-creative-monthly-results.json', JSON.stringify({
  generated_at: new Date().toISOString(),
  campaigns: CAMPAIGNS,
  adsets: all,
  first_month_spread: spread(fmCprs),
  lifetime_spread: spread(lifeCprs),
}, null, 2));
console.log('\nRaw results written to same-creative-monthly-results.json');
