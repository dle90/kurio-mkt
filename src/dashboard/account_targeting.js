// Do Kurio 2 / 3 / 5 fundamentally differ in targeting & reach?
// Pulls every ACTIVE ad set's targeting spec per account and tabulates the
// audience definition side by side, plus last-30d delivered reach.
// Decides whether same-code CPR is comparable across accounts.
import 'dotenv/config';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
  { id: 'act_1069029708221793', name: 'Kurio 5' },
];

function summarise(t = {}) {
  const flex = [];
  for (const f of t.flexible_spec || []) {
    for (const k of ['interests', 'behaviors', 'work_positions', 'industries', 'family_statuses', 'education_statuses']) {
      for (const x of f[k] || []) flex.push({ kind: k, name: x.name });
    }
  }
  const auto = t.targeting_automation || {};
  return {
    age_min: t.age_min ?? null,
    age_max: t.age_max ?? null,
    genders: t.genders || [],
    geo_countries: t.geo_locations?.countries || [],
    geo_cities: (t.geo_locations?.cities || []).map(c => c.name),
    geo_regions: (t.geo_locations?.regions || []).map(r => r.name),
    geo_location_types: t.geo_locations?.location_types || [],
    publisher_platforms: t.publisher_platforms || [],
    direct_interests: (t.interests || []).map(x => x.name),
    direct_behaviors: (t.behaviors || []).map(x => x.name),
    flex,
    custom_audience_ids: (t.custom_audiences || []).map(a => a.id),
    excluded_custom_audience_ids: (t.excluded_custom_audiences || []).map(a => a.id),
    advantage_audience: auto.advantage_audience === 1 || auto.advantage_audience === '1',
  };
}
const hasInterestStack = s =>
  s.direct_interests.length || s.direct_behaviors.length ||
  s.flex.some(i => ['interests', 'behaviors', 'family_statuses', 'education_statuses'].includes(i.kind));
const platformBucket = p => !p.length ? 'auto/all' : [...p].sort().join('+');

const pct = (n, d) => d ? Math.round(n / d * 100) + '%' : '—';
const tally = arr => {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ');
};

const report = [];
for (const acc of ACCOUNTS) {
  console.error(`Fetching ${acc.name} ad sets + targeting...`);
  let adsets = [];
  try {
    adsets = await meta.getAll(`/${acc.id}/adsets`, {
      fields: 'id,name,effective_status,optimization_goal,billing_event,bid_strategy,targeting,campaign{name,objective}',
      limit: 200,
    });
  } catch (e) { console.error(`  ${acc.name} adsets ERROR: ${e.message}`); }

  let reach30 = null, spend30 = null, freq30 = null, imp30 = null;
  try {
    const ins = await meta.getAll(`/${acc.id}/insights`, { date_preset: 'last_30d', fields: 'reach,impressions,spend,frequency' });
    if (ins[0]) { reach30 = +ins[0].reach || 0; spend30 = +ins[0].spend || 0; freq30 = +ins[0].frequency || 0; imp30 = +ins[0].impressions || 0; }
  } catch (e) { console.error(`  ${acc.name} insights ERROR: ${e.message}`); }

  const active = adsets.filter(a => a.effective_status === 'ACTIVE');
  const S = active.map(a => ({ ...summarise(a.targeting || {}), _a: a }));
  report.push({ acc, adsets, active, S, reach30, spend30, freq30, imp30 });
  console.error(`  ${adsets.length} ad sets, ${active.length} ACTIVE`);
}

const P = s => console.log(s);
P('='.repeat(78));
P('  KURIO 2 / 3 / 5 — ACTIVE ad-set targeting comparison');
P('='.repeat(78));

for (const r of report) {
  const { acc, active, S } = r;
  P('');
  P('─'.repeat(78));
  P(`  ${acc.name}  (${acc.id})`);
  P('─'.repeat(78));
  P(`  ACTIVE ad sets        : ${active.length}`);
  P(`  last-30d reach        : ${r.reach30 != null ? r.reach30.toLocaleString() : '—'} people` +
    `  ·  impressions ${r.imp30?.toLocaleString() ?? '—'}  ·  freq ${r.freq30?.toFixed(2) ?? '—'}`);
  P(`  last-30d spend        : ${r.spend30 != null ? Math.round(r.spend30).toLocaleString() + ' VND' : '—'}`);
  if (!S.length) { P('  (no active ad sets)'); continue; }
  P(`  objective             : ${tally(active.map(a => (a.campaign?.objective || '?').replace('OUTCOME_', '')))}`);
  P(`  optimization_goal     : ${tally(active.map(a => a.optimization_goal || '?'))}`);
  P(`  billing_event         : ${tally(active.map(a => a.billing_event || '?'))}`);
  P(`  bid_strategy          : ${tally(active.map(a => a.bid_strategy || '?'))}`);
  P(`  age range             : ${tally(S.map(s => `${s.age_min}-${s.age_max}`))}`);
  P(`  gender                : ${tally(S.map(s => s.genders.length ? s.genders.join(',') : 'all'))}` +
    `   (1=male 2=female)`);
  P(`  geo level             : ${tally(S.map(s => s.geo_cities.length ? `cities(${s.geo_cities.length})` : s.geo_regions.length ? `regions(${s.geo_regions.length})` : s.geo_countries.length ? `country:${s.geo_countries.join('')}` : 'none'))}`);
  const allCities = [...new Set(S.flatMap(s => s.geo_cities))];
  const allRegions = [...new Set(S.flatMap(s => s.geo_regions))];
  if (allCities.length) P(`    distinct cities     : ${allCities.slice(0, 20).join(', ')}${allCities.length > 20 ? ` …(+${allCities.length - 20})` : ''}`);
  if (allRegions.length) P(`    distinct regions    : ${allRegions.slice(0, 20).join(', ')}${allRegions.length > 20 ? ` …(+${allRegions.length - 20})` : ''}`);
  P(`  geo location_types    : ${tally(S.flatMap(s => s.geo_location_types.length ? s.geo_location_types : ['(default)']))}`);
  P(`  placements            : ${tally(S.map(s => platformBucket(s.publisher_platforms)))}`);
  P(`  interest/behavior stack: ${S.filter(s => hasInterestStack(s)).length}/${S.length}  (${pct(S.filter(s => hasInterestStack(s)).length, S.length)})`);
  P(`  custom audiences (pos): ${S.filter(s => s.custom_audience_ids.length).length}/${S.length}`);
  P(`  excluded audiences    : ${S.filter(s => s.excluded_custom_audience_ids.length).length}/${S.length}`);
  P(`  Advantage+ audience   : ${S.filter(s => s.advantage_audience).length}/${S.length}  (${pct(S.filter(s => s.advantage_audience).length, S.length)})`);
  const interests = [...new Set(S.flatMap(s => [...s.direct_interests, ...s.flex.filter(f => f.kind === 'interests').map(f => f.name)]))];
  if (interests.length) P(`  interests used        : ${interests.slice(0, 15).join(', ')}${interests.length > 15 ? ` …(+${interests.length - 15})` : ''}`);
}

// quick verdict line
P('');
P('='.repeat(78));
P('  SAME-CODE CPR COMPARABILITY');
P('='.repeat(78));
const dims = [
  ['optimization_goal', r => [...new Set(r.active.map(a => a.optimization_goal))].sort().join('|')],
  ['age range set', r => [...new Set(r.S.map(s => `${s.age_min}-${s.age_max}`))].sort().join('|')],
  ['gender set', r => [...new Set(r.S.map(s => s.genders.join(',') || 'all'))].sort().join('|')],
  ['geo level set', r => [...new Set(r.S.map(s => s.geo_cities.length ? 'cities' : s.geo_regions.length ? 'regions' : 'country'))].sort().join('|')],
  ['Advantage+ audience', r => r.S.length ? Math.round(r.S.filter(s => s.advantage_audience).length / r.S.length * 100) + '%' : '—'],
  ['interest-stack rate', r => r.S.length ? Math.round(r.S.filter(s => hasInterestStack(s)).length / r.S.length * 100) + '%' : '—'],
];
for (const [label, fn] of dims) {
  P(`  ${label.padEnd(22)} ` + report.map(r => `${r.acc.name.replace('Kurio ', 'K')}=${fn(r)}`).join('   '));
}
