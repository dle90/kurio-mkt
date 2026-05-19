// One-off: dig into Kurio 5 `CVS_TUANTA_12/05_code15_xpage - Bản sao`
// to explain the 31% LPV-rate vs siblings at 70-110%.
import { meta } from '../client.js';

const ACCT = 'act_1069029708221793'; // Kurio 5
const TARGET_NAME = 'CVS_TUANTA_12/05_code15_xpage - Bản sao';
const SIBLINGS = [
  'CVS_TUANTA_12/05_code45-xp',
  'CVS_TUANTA_12/05_intro2-xpage - Bản sao ',
  'CVS_TUANTA_12/05_code9+codeNQ',
  'CVS_TUANTA_12/05_code4-5',
];

const actionVal = (actions, type) => {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
};

async function main() {
  // 1. Find target campaign by name
  const campaigns = await meta.getAll(`/${ACCT}/campaigns`, {
    fields: 'id,name,objective,effective_status,daily_budget,lifetime_budget,created_time,updated_time',
    limit: 200,
  });
  const target = campaigns.find(c => c.name === TARGET_NAME);
  if (!target) { console.log('Target campaign not found'); return; }

  console.log(`\n=== TARGET: ${target.name} ===`);
  console.log(`  id=${target.id}  status=${target.effective_status}  obj=${target.objective}`);
  console.log(`  daily=${target.daily_budget}  lifetime=${target.lifetime_budget}`);
  console.log(`  created=${target.created_time}  updated=${target.updated_time}`);

  // 2. Get ad sets
  const adsets = await meta.getAll(`/${target.id}/adsets`, {
    fields: 'id,name,status,effective_status,daily_budget,optimization_goal,billing_event,destination_type,promoted_object,targeting,created_time',
    limit: 50,
  });
  console.log(`\n  ${adsets.length} ad set(s):`);
  for (const a of adsets) {
    console.log(`    - ${a.name}`);
    console.log(`        id=${a.id}  status=${a.effective_status}  goal=${a.optimization_goal}  dest=${a.destination_type}`);
    console.log(`        daily_budget=${a.daily_budget}  created=${a.created_time}`);
    if (a.promoted_object) console.log(`        promoted_object=${JSON.stringify(a.promoted_object)}`);
    const t = a.targeting || {};
    const tSummary = {
      age: `${t.age_min || '?'}-${t.age_max || '?'}`,
      countries: t.geo_locations?.countries,
      regions: t.geo_locations?.regions?.map(r => r.name).slice(0, 3),
      interests: (t.flexible_spec || t.interests || []).slice(0, 3),
      custom_audiences: t.custom_audiences?.length || 0,
      excluded_custom_audiences: t.excluded_custom_audiences?.length || 0,
      publisher_platforms: t.publisher_platforms,
      device_platforms: t.device_platforms,
    };
    console.log(`        targeting=${JSON.stringify(tSummary)}`);
  }

  // 3. Get ads + creative
  const ads = await meta.getAll(`/${target.id}/ads`, {
    fields: 'id,name,status,effective_status,adset_id,creative{id,name,object_story_id,object_story_spec,effective_object_story_id,thumbnail_url,image_url}',
    limit: 100,
  });
  console.log(`\n  ${ads.length} ad(s):`);
  for (const ad of ads) {
    const c = ad.creative || {};
    console.log(`    - ${ad.name}`);
    console.log(`        id=${ad.id}  status=${ad.effective_status}  adset=${ad.adset_id}`);
    console.log(`        creative_id=${c.id}  story=${c.object_story_id || c.effective_object_story_id}`);
    if (c.object_story_spec) {
      const oss = c.object_story_spec;
      const link = oss.link_data || oss.video_data;
      if (link) {
        console.log(`        LP link: ${link.link || link.call_to_action?.value?.link || '(none)'}`);
        console.log(`        message: ${(link.message || '').slice(0, 100)}`);
        console.log(`        cta: ${link.call_to_action?.type || '(none)'}`);
      }
    }
  }

  // 4. Ad-level insights for last_7d to see if one ad is broken
  console.log(`\n=== AD-LEVEL INSIGHTS (last_7d) ===`);
  const adInsights = await meta.getAll(`/${target.id}/insights`, {
    level: 'ad',
    date_preset: 'last_7d',
    fields: 'ad_id,ad_name,impressions,clicks,spend,ctr,frequency,actions',
    limit: 200,
  });
  console.log(`  ${adInsights.length} ad insight rows`);
  for (const row of adInsights) {
    const linkClicks = actionVal(row.actions, 'link_click');
    const lpv = actionVal(row.actions, 'landing_page_view');
    const reg = actionVal(row.actions, 'complete_registration');
    const spend = Number(row.spend) || 0;
    console.log(`    ${row.ad_name}`);
    console.log(`      spend=${Math.round(spend).toLocaleString()}  imp=${Number(row.impressions).toLocaleString()}  ctr=${row.ctr}  freq=${Number(row.frequency).toFixed(2)}`);
    console.log(`      link_clicks=${linkClicks}  lpv=${lpv}  lpv_rate=${linkClicks > 0 ? Math.round(lpv / linkClicks * 100) : '-'}%  reg=${reg}  cpr=${reg > 0 ? Math.round(spend / reg).toLocaleString() : '-'}`);
  }

  // 5. Sibling comparison: just adset-level LPV details
  console.log(`\n=== SIBLING ADSET LPV RATES (last_7d) ===`);
  for (const sibName of SIBLINGS) {
    const sib = campaigns.find(c => c.name === sibName);
    if (!sib) { console.log(`  ${sibName} — NOT FOUND`); continue; }
    const sibAdInsights = await meta.getAll(`/${sib.id}/insights`, {
      level: 'ad',
      date_preset: 'last_7d',
      fields: 'ad_id,ad_name,impressions,clicks,spend,actions',
      limit: 50,
    });
    let totLinks = 0, totLpv = 0, totSpend = 0, totReg = 0;
    for (const row of sibAdInsights) {
      totLinks += actionVal(row.actions, 'link_click');
      totLpv += actionVal(row.actions, 'landing_page_view');
      totReg += actionVal(row.actions, 'complete_registration');
      totSpend += Number(row.spend) || 0;
    }
    console.log(`  ${sibName}`);
    console.log(`    spend=${Math.round(totSpend).toLocaleString()}  link_clicks=${totLinks}  lpv=${totLpv}  lpv_rate=${totLinks > 0 ? Math.round(totLpv / totLinks * 100) : '-'}%  reg=${totReg}`);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
