// Creative cohort decay: pick the top N ads by lifetime registrations since 2025-10-01,
// then chart their monthly CPR trajectory. Tells us whether the winning creative
// formula is still pulling weight in recent months or is fatiguing.
import { writeFileSync } from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997', name: 'Kurio 3' },
];

const SINCE = '2025-10-01';
const UNTIL = new Date().toISOString().slice(0, 10);
const TOP_N = Number(process.env.TOP_N || 15);

function actionValue(actions, type) {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

function monthKey(date) {
  return date.slice(0, 7); // YYYY-MM
}

function cleanCreativeName(s) {
  if (!s) return '(no name)';
  // Same logic as src/analyze/creatives.js — strip date-hash suffix.
  return s.replace(/\s*-\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}.*$/, '').trim().slice(0, 70);
}

// 1. Pull lifetime ad insights (since SINCE) to rank top performers.
const lifetimeAds = [];
for (const acct of ACCOUNTS) {
  console.log(`Pulling ${acct.name} lifetime ad insights ${SINCE} → ${UNTIL}...`);
  const rows = await meta.getAll(`/${acct.id}/insights`, {
    level: 'ad',
    time_range: { since: SINCE, until: UNTIL },
    fields: 'ad_id,ad_name,campaign_id,campaign_name,spend,impressions,actions',
    limit: 200,
  });
  console.log(`  ${rows.length} ad rows`);
  for (const r of rows) {
    const reg = actionValue(r.actions, 'complete_registration');
    const spend = Number(r.spend) || 0;
    if (reg < 1) continue;
    lifetimeAds.push({
      account: acct.name,
      ad_id: r.ad_id,
      ad_name: r.ad_name,
      campaign_name: r.campaign_name,
      spend,
      reg,
      cpr: spend / reg,
    });
  }
}

lifetimeAds.sort((a, b) => b.reg - a.reg);
const topAds = lifetimeAds.slice(0, TOP_N);
console.log(`\nTop ${topAds.length} ads by lifetime registrations (since ${SINCE}):`);
for (const [i, a] of topAds.entries()) {
  console.log(`  #${i+1} [${a.account}] reg=${a.reg} CPR=${Math.round(a.cpr).toLocaleString()} VND  ${cleanCreativeName(a.ad_name)}`);
}

// 2. For each top ad, pull 30-day chunked insights to see month-over-month trend.
console.log(`\nFetching monthly trajectories for top ${topAds.length} ads...`);
for (const a of topAds) {
  try {
    const rows = await meta.getAll(`/${a.ad_id}/insights`, {
      time_increment: 30,
      time_range: { since: SINCE, until: UNTIL },
      fields: 'date_start,date_stop,spend,impressions,actions',
    });
    a.trajectory = rows.map(r => {
      const reg = actionValue(r.actions, 'complete_registration');
      const spend = Number(r.spend) || 0;
      return {
        period_start: r.date_start,
        period_end: r.date_stop,
        spend,
        reg,
        cpr: reg > 0 ? spend / reg : null,
      };
    });
  } catch (e) {
    console.log(`  ${a.ad_id} FAILED: ${e.message}`);
    a.trajectory = [];
  }
}

// 3. Print trajectory matrix.
const allPeriods = new Set();
for (const a of topAds) for (const t of a.trajectory) allPeriods.add(t.period_start);
const periods = [...allPeriods].sort();

console.log(`\n${'='.repeat(140)}`);
console.log(`Creative-cohort CPR trajectory — top ${topAds.length} ads, 30-day windows since ${SINCE}`);
console.log(`${'='.repeat(140)}\n`);

const headerCells = periods.map(p => p.slice(5)); // MM-DD
console.log('rank  acct      ' + headerCells.map(h => h.padStart(11)).join(' ') + '  | total reg');
console.log('-'.repeat(20 + (12 * periods.length) + 12));

for (const [i, a] of topAds.entries()) {
  const cells = periods.map(p => {
    const t = a.trajectory.find(x => x.period_start === p);
    if (!t) return '         - ';
    if (t.reg === 0) return '   0reg/' + Math.round(t.spend / 1000) + 'k';
    return `${Math.round(t.cpr).toLocaleString().padStart(7)} (${t.reg})`;
  });
  console.log(`#${(i+1).toString().padStart(2)}  ${a.account.padEnd(8)} ` + cells.map(c => c.padStart(11)).join(' ') + `  | ${a.reg}`);
}

// 4. Cohort summary: did the same ads get cheaper or more expensive over time?
function periodAggregate(periodStart) {
  let s = 0, r = 0;
  for (const a of topAds) {
    const t = a.trajectory.find(x => x.period_start === periodStart);
    if (t) { s += t.spend; r += t.reg; }
  }
  return { spend: s, reg: r, cpr: r > 0 ? s / r : null };
}

console.log(`\n${'='.repeat(80)}`);
console.log(`Top-${topAds.length} cohort aggregate CPR by 30-day window`);
console.log(`${'='.repeat(80)}\n`);
console.table(periods.map(p => {
  const agg = periodAggregate(p);
  return {
    period: p,
    spend: Math.round(agg.spend).toLocaleString(),
    reg: agg.reg,
    cohort_cpr: agg.cpr ? Math.round(agg.cpr).toLocaleString() : '-',
  };
}));

writeFileSync('creative-decay-results.json', JSON.stringify({
  generated_at: new Date().toISOString(),
  range: { since: SINCE, until: UNTIL },
  top_ads: topAds,
  periods,
}, null, 2));
console.log('\nRaw results written to creative-decay-results.json');
