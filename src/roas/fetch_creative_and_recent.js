// For the codes that matter (top ROAS + bottom ROAS at scale), pull:
//   1. Creative content (body, title, image/video URL, format)
//   2. Current status (ACTIVE / PAUSED / ARCHIVED)
//   3. Last 30 days spend (to detect fatigue / verify alive)
//
// Output: .cache/meta_creative.json — { ads: [{ ad_id, ad_name, status, creative_body, format, ... }] }
//         .cache/meta_spend_30d.json — same shape as meta_spend.json but last 30 days
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';
import { normalizeName } from './fetch_meta_spend.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
];

const today = new Date().toISOString().slice(0, 10);
const since30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

const main = async () => {
  // 1. Last 30 days spend per ad (for fatigue check)
  console.log(`Pulling last-30-day spend (${since30} → ${today})...`);
  const recent = [];
  for (const acc of ACCOUNTS) {
    console.log(`  ${acc.name}...`);
    const rows = await meta.getAll(`/${acc.id}/insights`, {
      level: 'ad',
      fields: 'ad_id,ad_name,spend,impressions,clicks',
      time_range: { since: since30, until: today },
      limit: 200,
    });
    for (const r of rows) {
      recent.push({
        account: acc.name,
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        ad_name_norm: normalizeName(r.ad_name),
        spend: +r.spend || 0,
        impressions: +r.impressions || 0,
        clicks: +r.clicks || 0,
      });
    }
    console.log(`    ${rows.length} rows`);
  }
  fs.writeFileSync('.cache/meta_spend_30d.json', JSON.stringify(recent, null, 2));
  console.log(`  wrote .cache/meta_spend_30d.json (${recent.length} rows)`);

  // 2. Ad creative + status — pull ALL ads from both accounts with creative expanded
  // (avoids picking-the-right-30 problem; we cross-reference offline)
  console.log('\nPulling ad creative + status for ALL ads...');
  const ads = [];
  for (const acc of ACCOUNTS) {
    console.log(`  ${acc.name}...`);
    const rows = await meta.getAll(`/${acc.id}/ads`, {
      fields: 'id,name,status,effective_status,adset_id,campaign_id,created_time,creative{body,title,name,image_url,video_id,object_type,call_to_action_type,thumbnail_url,object_story_id}',
      limit: 200,
    });
    for (const r of rows) {
      ads.push({
        account: acc.name,
        ad_id: r.id,
        ad_name: r.name,
        ad_name_norm: normalizeName(r.name),
        status: r.status,
        effective_status: r.effective_status,
        adset_id: r.adset_id,
        campaign_id: r.campaign_id,
        created_time: r.created_time,
        creative: r.creative ? {
          body: r.creative.body,
          title: r.creative.title,
          name: r.creative.name,
          image_url: r.creative.image_url,
          video_id: r.creative.video_id,
          object_type: r.creative.object_type,
          cta: r.creative.call_to_action_type,
          thumbnail_url: r.creative.thumbnail_url,
          object_story_id: r.creative.object_story_id,
        } : null,
      });
    }
    console.log(`    ${rows.length} ads`);
  }
  fs.writeFileSync('.cache/meta_creative.json', JSON.stringify(ads, null, 2));
  console.log(`  wrote .cache/meta_creative.json (${ads.length} ads)`);
};

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
