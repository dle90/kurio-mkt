import { meta } from './client.js';

const IDS = ['120233126215460017', '120233126168680017'];
const FIELDS = [
  'campaign_name', 'spend', 'impressions', 'reach', 'frequency',
  'cpm', 'ctr', 'cpc',
  'actions', 'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p100_watched_actions',
  'video_thruplay_watched_actions', 'video_30_sec_watched_actions',
  'video_avg_time_watched_actions',
].join(',');

const ACTION_LABELS = {
  'page_engagement': 'page engagement',
  'post_engagement': 'post engagement',
  'post_reaction': 'reactions (likes etc.)',
  'comment': 'comments',
  'post': 'shares',
  'like': 'page likes',
  'video_view': '3-sec video views',
  'photo_view': 'photo views',
  'link_click': 'link clicks',
  'landing_page_view': 'landing page views',
  'view_content': 'pixel ViewContent',
  'lead': 'leads',
  'onsite_conversion.lead_grouped': 'meta-form leads (grouped)',
  'complete_registration': 'registrations',
  'onsite_conversion.messaging_conversation_started_7d': 'messaging convos started',
};

function val(arr, type) {
  const a = (arr || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

for (const id of IDS) {
  const data = await meta.getAll(`/${id}/insights`, {
    date_preset: 'last_30d',
    fields: FIELDS,
  });
  const r = data[0];
  if (!r) { console.log(`${id}: no insights`); continue; }

  const spend = Number(r.spend) || 0;
  const reach = Number(r.reach) || 0;
  const imp = Number(r.impressions) || 0;
  const cpReach = reach > 0 ? spend / reach * 1000 : 0;

  console.log(`\n=== ${r.campaign_name} (id ${id}) — last 30d ===\n`);
  console.log(`  spend: ${spend.toLocaleString()} VND`);
  console.log(`  reach (unique users): ${reach.toLocaleString()}`);
  console.log(`  impressions: ${imp.toLocaleString()}`);
  console.log(`  frequency: ${Number(r.frequency).toFixed(2)} (avg times shown per user)`);
  console.log(`  CPM (per 1k impressions): ${Number(r.cpm).toLocaleString()} VND`);
  console.log(`  Cost per 1k reach: ${cpReach.toFixed(0).toLocaleString()} VND`);
  console.log(`  CTR: ${Number(r.ctr).toFixed(2)}%   CPC: ${Number(r.cpc).toLocaleString()} VND`);

  console.log(`\n  Engagement breakdown:`);
  for (const [t, label] of Object.entries(ACTION_LABELS)) {
    const v = val(r.actions, t);
    if (v > 0) console.log(`    ${label.padEnd(34)} ${v.toLocaleString()}`);
  }

  console.log(`\n  Video watch funnel:`);
  const v3 = val(r.actions, 'video_view');
  const p25 = val(r.video_p25_watched_actions, 'video_view');
  const p50 = val(r.video_p50_watched_actions, 'video_view');
  const p75 = val(r.video_p75_watched_actions, 'video_view');
  const p100 = val(r.video_p100_watched_actions, 'video_view');
  const thru = val(r.video_thruplay_watched_actions, 'video_view');
  const sec30 = val(r.video_30_sec_watched_actions, 'video_view');
  const avgTime = val(r.video_avg_time_watched_actions, 'video_view');
  if (v3 + p25 + p100 === 0) {
    console.log(`    (no video metrics — likely not a video creative)`);
  } else {
    const pct = n => imp > 0 ? `(${(n / imp * 100).toFixed(1)}% of imp)` : '';
    console.log(`    3-sec views: ${v3.toLocaleString()} ${pct(v3)}`);
    console.log(`    25%:         ${p25.toLocaleString()} ${pct(p25)}`);
    console.log(`    50%:         ${p50.toLocaleString()} ${pct(p50)}`);
    console.log(`    75%:         ${p75.toLocaleString()} ${pct(p75)}`);
    console.log(`    100%:        ${p100.toLocaleString()} ${pct(p100)}`);
    console.log(`    ThruPlay (15s or full): ${thru.toLocaleString()} ${pct(thru)}`);
    console.log(`    30-sec watched: ${sec30.toLocaleString()}`);
    console.log(`    avg watch time: ${avgTime.toFixed(1)}s`);
    if (v3 > 0) {
      console.log(`    hook rate (3s/imp): ${(v3 / imp * 100).toFixed(1)}%`);
      console.log(`    hold rate (100%/3s): ${(p100 / v3 * 100).toFixed(1)}%`);
      if (thru > 0) console.log(`    cost per ThruPlay: ${(spend / thru).toFixed(0)} VND`);
    }
  }
}
