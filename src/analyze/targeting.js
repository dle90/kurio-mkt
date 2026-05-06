import { meta } from '../client.js';

const PAIRS = [
  // Same creative body: "TỪ HỌC SINH SUÝT Ở LẠI LỚP - CON VƯƠN LÊN TOP 5..."
  { account: 'act_930175825635997', name: 'CVS_TUANTA_CODE83_xpage_kv', tier: 'TOP' },
  { account: 'act_1071893357737329', name: 'CVS_TUANTA_25/07_CODE83+84_Xpage', tier: 'TOP' },
  { account: 'act_1071893357737329', name: 'CVS_TUANTA_05/01_CODE83+84 - Bản sao 2', tier: 'TOP' },
  { account: 'act_1071893357737329', name: 'CVS_TUANTA_05/01_CODE83+84 - TG - Bản sao', tier: 'BOTTOM' },
  { account: 'act_930175825635997', name: 'CVS_TUANTA_04/08_CODE81+83+84_TG - LT - Bản sao 4', tier: 'BOTTOM' },
];

const audienceCache = new Map();
async function resolveAudience(id) {
  if (audienceCache.has(id)) return audienceCache.get(id);
  try {
    const a = await meta.get(`/${id}`, { fields: 'name,subtype,approximate_count_lower_bound,approximate_count_upper_bound' });
    const label = `${a.name} [${a.subtype}${a.approximate_count_lower_bound ? ` ~${a.approximate_count_lower_bound.toLocaleString()}` : ''}]`;
    audienceCache.set(id, label);
    return label;
  } catch (e) {
    audienceCache.set(id, `(${id} — ${e.message.slice(0, 60)})`);
    return audienceCache.get(id);
  }
}

async function summariseTargeting(t = {}) {
  const out = {
    age: `${t.age_min ?? '?'}-${t.age_max ?? '?'}`,
    genders: t.genders?.length ? t.genders.join(',') : 'all',
    geo_countries: t.geo_locations?.countries?.join(',') || null,
    geo_cities: t.geo_locations?.cities?.map(c => c.name).join(',') || null,
    geo_regions: t.geo_locations?.regions?.map(r => r.name).join(',') || null,
    locales: t.locales?.length ? `${t.locales.length} locale(s)` : null,
    publisher_platforms: t.publisher_platforms?.join(',') || 'auto',
    facebook_positions: t.facebook_positions?.join(',') || null,
    instagram_positions: t.instagram_positions?.join(',') || null,
    device_platforms: t.device_platforms?.join(',') || null,
    interests: [],
    behaviors: [],
    flexible: [],
    custom_audiences: [],
    excluded_custom_audiences: [],
  };
  for (const i of t.interests || []) out.interests.push(i.name);
  for (const b of t.behaviors || []) out.behaviors.push(b.name);
  for (const f of t.flexible_spec || []) {
    const items = [];
    for (const k of ['interests', 'behaviors', 'work_positions', 'industries', 'family_statuses']) {
      for (const x of f[k] || []) items.push(`${k}:${x.name}`);
    }
    if (items.length) out.flexible.push(items);
  }
  for (const a of t.custom_audiences || []) out.custom_audiences.push(await resolveAudience(a.id));
  for (const a of t.excluded_custom_audiences || []) out.excluded_custom_audiences.push(await resolveAudience(a.id));
  return out;
}

console.log('Pulling targeting for 5 campaigns running the same "SUÝT Ở LẠI LỚP" body...\n');

const results = [];
for (const p of PAIRS) {
  const campaigns = await meta.getAll(`/${p.account}/campaigns`, {
    fields: 'id,name',
    limit: 200,
  });
  const camp = campaigns.find(c => c.name === p.name);
  if (!camp) { console.log(`[${p.tier}] ${p.name}: NOT FOUND`); continue; }

  const adsets = await meta.getAll(`/${camp.id}/adsets`, {
    fields: 'id,name,effective_status,daily_budget,lifetime_budget,bid_strategy,optimization_goal,billing_event,destination_type,promoted_object,targeting,start_time,end_time,created_time',
    limit: 50,
  });

  const insights = await meta.getAll(`/${camp.id}/insights`, {
    level: 'adset',
    date_preset: 'last_90d',
    fields: 'adset_id,adset_name,spend,impressions,reach,frequency,actions',
  });
  const insightByAdset = Object.fromEntries(insights.map(r => [r.adset_id, r]));

  for (const a of adsets) {
    const ins = insightByAdset[a.id];
    const reg = ((ins?.actions || []).find(x => x.action_type === 'complete_registration')?.value) || 0;
    const spend = Number(ins?.spend) || 0;
    results.push({
      tier: p.tier,
      account: p.account.endsWith('1071893357737329') ? 'Kurio 2' : 'Kurio 3',
      campaign: p.name,
      adset: a.name,
      adset_id: a.id,
      status: a.effective_status,
      optimization_goal: a.optimization_goal,
      destination: a.destination_type,
      daily_budget: a.daily_budget,
      spend,
      reach: Number(ins?.reach) || 0,
      frequency: Number(ins?.frequency) || 0,
      reg: Number(reg),
      cpr: reg > 0 ? spend / reg : null,
      targeting: await summariseTargeting(a.targeting),
    });
  }
}

function printGroup(label, rows) {
  console.log(`\n${'='.repeat(80)}\n${label}\n${'='.repeat(80)}\n`);
  for (const r of rows) {
    console.log(`[${r.tier}] ${r.account} — ${r.campaign}`);
    console.log(`  ad set: ${r.adset} (${r.adset_id})  status=${r.status}`);
    console.log(`  spend=${Math.round(r.spend).toLocaleString()} VND  reg=${r.reg}  CPR=${r.cpr ? Math.round(r.cpr).toLocaleString() : '-'}  reach=${r.reach.toLocaleString()}  freq=${r.frequency.toFixed(2)}`);
    console.log(`  optimization=${r.optimization_goal}  destination=${r.destination}  daily_budget=${r.daily_budget || '-'}`);
    const t = r.targeting;
    console.log(`  age=${t.age}  gender=${t.genders}  geo=${t.geo_cities || t.geo_regions || t.geo_countries || '?'}  locales=${t.locales || '-'}`);
    console.log(`  platforms=${t.publisher_platforms}  fb_positions=${t.facebook_positions || '-'}  ig_positions=${t.instagram_positions || '-'}  device=${t.device_platforms || 'all'}`);
    if (t.interests.length) console.log(`  interests: ${t.interests.join(', ')}`);
    if (t.behaviors.length) console.log(`  behaviors: ${t.behaviors.join(', ')}`);
    for (const f of t.flexible) console.log(`  flexible: ${f.join(' / ')}`);
    if (t.custom_audiences.length) console.log(`  custom_audiences: ${t.custom_audiences.join(' | ')}`);
    if (t.excluded_custom_audiences.length) console.log(`  EXCLUDED: ${t.excluded_custom_audiences.join(' | ')}`);
    console.log();
  }
}

printGroup('TOP-tier campaigns', results.filter(r => r.tier === 'TOP'));
printGroup('BOTTOM-tier campaigns', results.filter(r => r.tier === 'BOTTOM'));
