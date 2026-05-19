// Compare code15 vs code45 (best sibling) — targeting, creative, LP signals
import { meta } from '../client.js';

const ACCT = 'act_1069029708221793'; // Kurio 5
const CAMPS = ['CVS_TUANTA_12/05_code15_xpage - Bản sao', 'CVS_TUANTA_12/05_code45-xp'];

async function main() {
  const campaigns = await meta.getAll(`/${ACCT}/campaigns`, {
    fields: 'id,name,objective,effective_status',
    limit: 200,
  });

  for (const target of CAMPS) {
    const c = campaigns.find(x => x.name === target);
    if (!c) { console.log(`NOT FOUND: ${target}`); continue; }
    console.log(`\n\n========== ${c.name} (${c.id}) ==========`);

    const adsets = await meta.getAll(`/${c.id}/adsets`, {
      fields: 'id,name,optimization_goal,destination_type,promoted_object,targeting,daily_budget',
      limit: 50,
    });
    for (const a of adsets) {
      const t = a.targeting || {};
      const fs = (t.flexible_spec || [])[0] || {};
      console.log(`\n  AD SET ${a.id} (${a.name})`);
      console.log(`    goal=${a.optimization_goal} dest=${a.destination_type} daily=${a.daily_budget}`);
      console.log(`    promoted_object=${JSON.stringify(a.promoted_object)}`);
      console.log(`    age=${t.age_min}-${t.age_max}`);
      console.log(`    interests (${(fs.interests || []).length}): ${(fs.interests || []).map(i => i.name).join(', ')}`);
      console.log(`    family_statuses (${(fs.family_statuses || []).length}): ${(fs.family_statuses || []).map(i => i.name).join(', ')}`);
      console.log(`    custom_audiences=${(t.custom_audiences || []).length}  excluded=${(t.excluded_custom_audiences || []).length}`);
      console.log(`    platforms=${t.publisher_platforms?.join(',')}  devices=${t.device_platforms?.join(',')}`);
      console.log(`    positions=fb:${t.facebook_positions?.join(',')} ig:${t.instagram_positions?.join(',')}`);
    }

    const ads = await meta.getAll(`/${c.id}/ads`, {
      fields: 'id,name,effective_status,creative{id,name,object_story_id,thumbnail_url}',
      limit: 50,
    });
    console.log(`\n  ADS (${ads.length}):`);
    for (const ad of ads) {
      console.log(`    ${ad.name}  status=${ad.effective_status}`);
      console.log(`      creative_name="${(ad.creative?.name || '').slice(0, 160)}"`);
      console.log(`      story=${ad.creative?.object_story_id}`);
      console.log(`      thumbnail=${ad.creative?.thumbnail_url}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
