// K — Investigate the week of 2026-04-29 (the period's best CPR: 239k VND on 59M VND spend).
// Pull campaign-level + ad-level breakdown for that week vs the prior week (Apr 22)
// to see what drove the unusual efficiency.
import { writeFileSync } from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997', name: 'Kurio 3' },
];

const WEEKS = [
  { label: 'BEST  (Apr 29 → May 5)', since: '2026-04-29', until: '2026-05-05' },
  { label: 'PRIOR (Apr 22 → Apr 28)', since: '2026-04-22', until: '2026-04-28' },
  { label: 'EARLY (Apr 8 → Apr 14)',  since: '2026-04-08', until: '2026-04-14' }, // worst recent week
];

function actionValue(actions, type) {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

function cleanName(s) {
  return (s || '').replace(/\s*-\s*\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}.*$/, '').trim();
}

const out = { weeks: {} };

for (const w of WEEKS) {
  console.log(`\n${'='.repeat(110)}`);
  console.log(`${w.label} — ${w.since} → ${w.until}`);
  console.log(`${'='.repeat(110)}\n`);

  const campRows = [];
  for (const acct of ACCOUNTS) {
    const rows = await meta.getAll(`/${acct.id}/insights`, {
      level: 'campaign',
      time_range: { since: w.since, until: w.until },
      fields: 'campaign_id,campaign_name,spend,impressions,actions',
      limit: 200,
    });
    for (const r of rows) {
      const reg = actionValue(r.actions, 'complete_registration');
      const spend = Number(r.spend) || 0;
      const lpv = actionValue(r.actions, 'landing_page_view');
      campRows.push({
        account: acct.name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        spend,
        reg,
        lpv,
        cpr: reg > 0 ? spend / reg : null,
        cplpv: lpv > 0 ? spend / lpv : null,
      });
    }
  }

  const totals = campRows.reduce((s, r) => ({
    spend: s.spend + r.spend,
    reg: s.reg + r.reg,
    lpv: s.lpv + r.lpv,
  }), { spend: 0, reg: 0, lpv: 0 });

  console.log(`Total: spend=${Math.round(totals.spend).toLocaleString()} VND, reg=${totals.reg}, LPV=${totals.lpv}, CPR=${totals.reg > 0 ? Math.round(totals.spend / totals.reg).toLocaleString() : '-'} VND, reg/LPV=${totals.lpv > 0 ? ((totals.reg/totals.lpv)*100).toFixed(1) : '-'}%`);

  const top = campRows.filter(r => r.spend > 1_000_000).sort((a, b) => (b.reg) - (a.reg)).slice(0, 15);
  console.log(`\nTop 15 campaigns by registrations (spend > 1M VND):`);
  console.table(top.map(r => ({
    account: r.account,
    campaign: cleanName(r.campaign_name).slice(0, 50),
    spend: Math.round(r.spend).toLocaleString(),
    reg: r.reg,
    cpr: r.cpr ? Math.round(r.cpr).toLocaleString() : '-',
    lpv: r.lpv,
    'reg/lpv': r.lpv > 0 ? ((r.reg / r.lpv) * 100).toFixed(1) + '%' : '-',
  })));

  out.weeks[w.label] = { totals, campaigns: campRows };
}

// Cross-week diff: which campaigns existed in BEST but not in PRIOR (and vice versa)?
const best = out.weeks[WEEKS[0].label].campaigns;
const prior = out.weeks[WEEKS[1].label].campaigns;
const bestById = Object.fromEntries(best.map(c => [c.campaign_id, c]));
const priorById = Object.fromEntries(prior.map(c => [c.campaign_id, c]));

const onlyInBest = best.filter(c => !priorById[c.campaign_id] && c.spend > 500_000);
const onlyInPrior = prior.filter(c => !bestById[c.campaign_id] && c.spend > 500_000);

console.log(`\n${'='.repeat(110)}`);
console.log(`Diff — campaigns active in BEST week but NOT prior week (spend > 500k)`);
console.log(`${'='.repeat(110)}`);
console.table(onlyInBest.map(r => ({
  account: r.account,
  campaign: cleanName(r.campaign_name).slice(0, 60),
  spend: Math.round(r.spend).toLocaleString(),
  reg: r.reg,
  cpr: r.cpr ? Math.round(r.cpr).toLocaleString() : '-',
})));

console.log(`\nDiff — campaigns active in PRIOR week but NOT best week (spend > 500k)`);
console.table(onlyInPrior.map(r => ({
  account: r.account,
  campaign: cleanName(r.campaign_name).slice(0, 60),
  spend: Math.round(r.spend).toLocaleString(),
  reg: r.reg,
  cpr: r.cpr ? Math.round(r.cpr).toLocaleString() : '-',
})));

// Same-campaign delta — campaigns active in both weeks, biggest CPR shifts.
const sameDelta = [];
for (const c of best) {
  const p = priorById[c.campaign_id];
  if (!p || !p.cpr || !c.cpr || c.spend < 500_000 || p.spend < 500_000) continue;
  sameDelta.push({
    account: c.account,
    campaign: cleanName(c.campaign_name).slice(0, 50),
    cpr_prior: Math.round(p.cpr),
    cpr_best: Math.round(c.cpr),
    delta_pct: Math.round(((c.cpr - p.cpr) / p.cpr) * 100),
    reg_prior: p.reg,
    reg_best: c.reg,
    spend_best: Math.round(c.spend).toLocaleString(),
  });
}
sameDelta.sort((a, b) => a.delta_pct - b.delta_pct);
console.log(`\n${'='.repeat(110)}`);
console.log(`Campaigns active in BOTH weeks — biggest CPR improvements (negative delta = better)`);
console.log(`${'='.repeat(110)}`);
console.table(sameDelta.slice(0, 15));
console.log(`\nBiggest CPR worsenings:`);
console.table(sameDelta.slice(-10).reverse());

writeFileSync('week-apr29-results.json', JSON.stringify(out, null, 2));
console.log('\nRaw results written to week-apr29-results.json');
