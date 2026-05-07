// Validate the broad-targeting hypothesis at scale.
// Pull adset-level insights for last_90d on Kurio 2 + Kurio 3, filter to SALES
// campaigns with meaningful spend, rank by CPR, then fetch targeting for the
// top 30 (lowest CPR) and bottom 30 (highest CPR / zero-reg high-spend).
// Tabulate the no-interests pattern across the two tiers.
import { writeFileSync } from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997', name: 'Kurio 3' },
];

const DATE_PRESET = process.env.DATE_PRESET || 'last_90d';
const MIN_SPEND = Number(process.env.MIN_SPEND || 500_000); // VND, signal floor
const TOP_N = Number(process.env.TOP_N || 30);
const BOTTOM_N = Number(process.env.BOTTOM_N || 30);

function actionValue(actions, type) {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

async function pullCampaignsByObjective(accountId) {
  const camps = await meta.getAll(`/${accountId}/campaigns`, {
    fields: 'id,name,objective',
    limit: 200,
  });
  return Object.fromEntries(camps.map(c => [c.id, c]));
}

async function pullAdsetInsights(accountId) {
  return meta.getAll(`/${accountId}/insights`, {
    level: 'adset',
    date_preset: DATE_PRESET,
    fields: 'adset_id,adset_name,campaign_id,campaign_name,spend,reach,frequency,impressions,actions',
    limit: 200,
  });
}

async function fetchTargeting(adsetId) {
  return meta.get(`/${adsetId}`, {
    fields: 'id,name,effective_status,optimization_goal,destination_type,bid_strategy,daily_budget,lifetime_budget,start_time,created_time,targeting',
  });
}

const audienceCache = new Map();
async function resolveAudience(id) {
  if (audienceCache.has(id)) return audienceCache.get(id);
  try {
    const a = await meta.get(`/${id}`, {
      fields: 'name,subtype,approximate_count_lower_bound,approximate_count_upper_bound',
    });
    const lo = a.approximate_count_lower_bound;
    const label = `${a.name} [${a.subtype}${lo ? ` ~${lo.toLocaleString()}` : ''}]`;
    audienceCache.set(id, label);
    return label;
  } catch (e) {
    const label = `(${id} — ${e.message.slice(0, 50)})`;
    audienceCache.set(id, label);
    return label;
  }
}

function summariseTargetingSync(t = {}) {
  // Sync version that doesn't resolve custom audience names — used for tier stats.
  const flexItems = [];
  for (const f of t.flexible_spec || []) {
    for (const k of ['interests', 'behaviors', 'work_positions', 'industries', 'family_statuses', 'education_statuses']) {
      for (const x of f[k] || []) flexItems.push({ kind: k, name: x.name });
    }
  }
  return {
    age_min: t.age_min ?? null,
    age_max: t.age_max ?? null,
    genders: t.genders || [],
    geo_countries: t.geo_locations?.countries || [],
    geo_cities: (t.geo_locations?.cities || []).map(c => c.name),
    geo_regions: (t.geo_locations?.regions || []).map(r => r.name),
    publisher_platforms: t.publisher_platforms || [],
    facebook_positions: t.facebook_positions || [],
    instagram_positions: t.instagram_positions || [],
    device_platforms: t.device_platforms || [],
    direct_interests: (t.interests || []).map(x => x.name),
    direct_behaviors: (t.behaviors || []).map(x => x.name),
    flexible_items: flexItems,
    custom_audience_ids: (t.custom_audiences || []).map(a => a.id),
    excluded_custom_audience_ids: (t.excluded_custom_audiences || []).map(a => a.id),
  };
}

function hasInterestStack(s) {
  if (s.direct_interests.length || s.direct_behaviors.length) return true;
  return s.flexible_items.some(i =>
    i.kind === 'interests' ||
    i.kind === 'behaviors' ||
    i.kind === 'family_statuses' ||
    i.kind === 'education_statuses'
  );
}

function geoBucket(s) {
  if (s.geo_cities.length) return `cities(${s.geo_cities.length})`;
  if (s.geo_regions.length) return `regions(${s.geo_regions.length})`;
  if (s.geo_countries.length) return `countries(${s.geo_countries.join(',')})`;
  return 'none';
}

function platformBucket(s) {
  const p = s.publisher_platforms;
  if (!p.length) return 'auto';
  return p.sort().join('+');
}

// 1. Pull insights and campaign objectives for both accounts.
console.log(`Pulling adset insights (${DATE_PRESET}) and campaign objectives...\n`);
const allInsights = [];
for (const acct of ACCOUNTS) {
  console.log(`  ${acct.name} (${acct.id}): fetching campaigns...`);
  const campMap = await pullCampaignsByObjective(acct.id);
  console.log(`    ${Object.keys(campMap).length} campaigns total`);
  console.log(`  ${acct.name}: fetching adset insights...`);
  const rows = await pullAdsetInsights(acct.id);
  console.log(`    ${rows.length} adset insight rows`);
  for (const r of rows) {
    const camp = campMap[r.campaign_id];
    if (!camp) continue;
    const spend = Number(r.spend) || 0;
    const reg = actionValue(r.actions, 'complete_registration');
    allInsights.push({
      account: acct.name,
      account_id: acct.id,
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      objective: camp.objective,
      adset_id: r.adset_id,
      adset_name: r.adset_name,
      spend,
      reach: Number(r.reach) || 0,
      impressions: Number(r.impressions) || 0,
      frequency: Number(r.frequency) || 0,
      reg,
      cpr: reg > 0 ? spend / reg : null,
    });
  }
}

console.log(`\nTotal adset rows: ${allInsights.length}`);

// 2. Filter to SALES with meaningful spend.
const salesPool = allInsights.filter(r =>
  r.objective === 'OUTCOME_SALES' && r.spend >= MIN_SPEND
);
console.log(`After filter (OUTCOME_SALES, spend >= ${MIN_SPEND.toLocaleString()} VND): ${salesPool.length} adsets`);

const withReg = salesPool.filter(r => r.reg > 0).sort((a, b) => a.cpr - b.cpr);
const zeroReg = salesPool.filter(r => r.reg === 0).sort((a, b) => b.spend - a.spend);
console.log(`  ${withReg.length} adsets with reg >= 1`);
console.log(`  ${zeroReg.length} adsets with reg = 0 (CPR = ∞)`);

// 3. Pick top/bottom.
const topAdsets = withReg.slice(0, TOP_N);
// Bottom = worst CPR among reg>0, padded with zero-reg high-spend if needed.
const worstReg = withReg.slice(-BOTTOM_N).reverse(); // worst CPR first
let bottomAdsets;
if (zeroReg.length >= BOTTOM_N) {
  // Prefer zero-reg high-spend (definitionally worst — burned spend, no signal)
  bottomAdsets = zeroReg.slice(0, BOTTOM_N);
} else {
  bottomAdsets = [...zeroReg, ...worstReg].slice(0, BOTTOM_N);
}

console.log(`\nTop ${topAdsets.length} (lowest CPR): ${topAdsets[0]?.cpr?.toLocaleString()} – ${topAdsets[topAdsets.length-1]?.cpr?.toLocaleString()} VND`);
console.log(`Bottom ${bottomAdsets.length} (highest CPR or zero-reg): worst spend=${bottomAdsets[0]?.spend?.toLocaleString()} VND`);

// 4. Fetch targeting for selected ad sets.
async function annotateWithTargeting(rows, label) {
  console.log(`\nFetching targeting for ${rows.length} ${label} ad sets...`);
  for (const [i, r] of rows.entries()) {
    try {
      const det = await fetchTargeting(r.adset_id);
      r.optimization_goal = det.optimization_goal;
      r.destination_type = det.destination_type;
      r.bid_strategy = det.bid_strategy;
      r.daily_budget = det.daily_budget;
      r.created_time = det.created_time;
      r.targeting = summariseTargetingSync(det.targeting || {});
    } catch (e) {
      console.log(`  [${i+1}/${rows.length}] ${r.adset_id} FAILED: ${e.message}`);
      r.targeting = null;
    }
    if ((i + 1) % 10 === 0) console.log(`  ${i+1}/${rows.length}`);
  }
}

await annotateWithTargeting(topAdsets, 'TOP');
await annotateWithTargeting(bottomAdsets, 'BOTTOM');

// Resolve audience names for the union.
const audIds = new Set();
for (const r of [...topAdsets, ...bottomAdsets]) {
  if (!r.targeting) continue;
  for (const id of r.targeting.custom_audience_ids) audIds.add(id);
  for (const id of r.targeting.excluded_custom_audience_ids) audIds.add(id);
}
console.log(`\nResolving ${audIds.size} unique custom audience IDs...`);
for (const id of audIds) await resolveAudience(id);

// 5. Tabulate.
function tierStats(rows) {
  const valid = rows.filter(r => r.targeting);
  const n = valid.length;
  if (n === 0) return null;
  const withInterests = valid.filter(r => hasInterestStack(r.targeting)).length;
  const withCustom = valid.filter(r => r.targeting.custom_audience_ids.length).length;
  const withExcluded = valid.filter(r => r.targeting.excluded_custom_audience_ids.length).length;
  const fbOnly = valid.filter(r => {
    const p = r.targeting.publisher_platforms;
    return p.length === 1 && p[0] === 'facebook';
  }).length;
  const allPlatforms = valid.filter(r => {
    const p = r.targeting.publisher_platforms;
    return p.length === 0 || p.length >= 3;
  }).length;
  const genderAll = valid.filter(r => r.targeting.genders.length === 0).length;
  const genderFemale = valid.filter(r => r.targeting.genders.length === 1 && r.targeting.genders[0] === 2).length;
  const genderMale = valid.filter(r => r.targeting.genders.length === 1 && r.targeting.genders[0] === 1).length;
  const cityTargeted = valid.filter(r => r.targeting.geo_cities.length > 0).length;
  const ages = valid.map(r => [r.targeting.age_min, r.targeting.age_max]);
  return {
    n,
    pct_with_interest_stack: ((withInterests / n) * 100).toFixed(0) + '%',
    pct_with_custom_audience: ((withCustom / n) * 100).toFixed(0) + '%',
    pct_with_lookalike_exclusion: ((withExcluded / n) * 100).toFixed(0) + '%',
    pct_fb_only: ((fbOnly / n) * 100).toFixed(0) + '%',
    pct_all_platforms: ((allPlatforms / n) * 100).toFixed(0) + '%',
    pct_gender_all: ((genderAll / n) * 100).toFixed(0) + '%',
    pct_gender_female: ((genderFemale / n) * 100).toFixed(0) + '%',
    pct_gender_male: ((genderMale / n) * 100).toFixed(0) + '%',
    pct_city_targeted: ((cityTargeted / n) * 100).toFixed(0) + '%',
    age_ranges: ages,
  };
}

const topStats = tierStats(topAdsets);
const bottomStats = tierStats(bottomAdsets);

console.log(`\n${'='.repeat(80)}\nTIER COMPARISON — top ${TOP_N} vs bottom ${BOTTOM_N} ad sets by CPR\n${'='.repeat(80)}`);
console.table([
  { metric: 'sample size', TOP: topStats.n, BOTTOM: bottomStats.n },
  { metric: 'has interest/behavior/family stack', TOP: topStats.pct_with_interest_stack, BOTTOM: bottomStats.pct_with_interest_stack },
  { metric: 'has custom audience', TOP: topStats.pct_with_custom_audience, BOTTOM: bottomStats.pct_with_custom_audience },
  { metric: 'excludes lookalike of converters', TOP: topStats.pct_with_lookalike_exclusion, BOTTOM: bottomStats.pct_with_lookalike_exclusion },
  { metric: 'Facebook-only placement', TOP: topStats.pct_fb_only, BOTTOM: bottomStats.pct_fb_only },
  { metric: 'all/auto placements', TOP: topStats.pct_all_platforms, BOTTOM: bottomStats.pct_all_platforms },
  { metric: 'gender = all', TOP: topStats.pct_gender_all, BOTTOM: bottomStats.pct_gender_all },
  { metric: 'gender = female only', TOP: topStats.pct_gender_female, BOTTOM: bottomStats.pct_gender_female },
  { metric: 'gender = male only', TOP: topStats.pct_gender_male, BOTTOM: bottomStats.pct_gender_male },
  { metric: 'city-targeted (vs nationwide)', TOP: topStats.pct_city_targeted, BOTTOM: bottomStats.pct_city_targeted },
]);

function printRows(label, rows) {
  console.log(`\n${'='.repeat(80)}\n${label}\n${'='.repeat(80)}\n`);
  for (const [i, r] of rows.entries()) {
    const t = r.targeting;
    console.log(`#${i+1} [${r.account}] ${r.adset_name}`);
    console.log(`   campaign: ${r.campaign_name}`);
    console.log(`   spend=${Math.round(r.spend).toLocaleString()} VND  reg=${r.reg}  CPR=${r.cpr ? Math.round(r.cpr).toLocaleString() : '∞'}  reach=${r.reach.toLocaleString()}  freq=${r.frequency.toFixed(2)}`);
    if (!t) { console.log('   (targeting fetch failed)'); continue; }
    const interestStack = hasInterestStack(t);
    console.log(`   age=${t.age_min}-${t.age_max}  gender=${t.genders.length ? t.genders.join(',') : 'all'}  geo=${geoBucket(t)}  platforms=${platformBucket(t)}`);
    console.log(`   interest_stack=${interestStack ? 'YES' : 'no'}  custom_aud=${t.custom_audience_ids.length}  excluded=${t.excluded_custom_audience_ids.length}`);
    if (t.direct_interests.length) console.log(`   interests: ${t.direct_interests.join(', ')}`);
    if (t.direct_behaviors.length) console.log(`   behaviors: ${t.direct_behaviors.join(', ')}`);
    for (const f of (function groupFlex(items){
      const map = new Map();
      for (const it of items) { if (!map.has(it.kind)) map.set(it.kind, []); map.get(it.kind).push(it.name); }
      return [...map.entries()].map(([k, v]) => `${k}: ${v.join(', ')}`);
    })(t.flexible_items)) console.log(`   flexible ${f}`);
    if (t.custom_audience_ids.length) console.log(`   custom_aud: ${t.custom_audience_ids.map(id => audienceCache.get(id) || id).join(' | ')}`);
    if (t.excluded_custom_audience_ids.length) console.log(`   EXCLUDED: ${t.excluded_custom_audience_ids.map(id => audienceCache.get(id) || id).join(' | ')}`);
    console.log();
  }
}

printRows(`TOP ${TOP_N} ad sets — lowest CPR`, topAdsets);
printRows(`BOTTOM ${BOTTOM_N} ad sets — highest CPR / zero registrations`, bottomAdsets);

// 6. Persist raw output.
const outPath = 'targeting-scale-results.json';
writeFileSync(outPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  date_preset: DATE_PRESET,
  min_spend: MIN_SPEND,
  pool_size: salesPool.length,
  top: topAdsets,
  bottom: bottomAdsets,
  tier_stats: { top: topStats, bottom: bottomStats },
  audience_resolutions: Object.fromEntries(audienceCache),
}, null, 2));
console.log(`\nRaw results written to ${outPath}`);
