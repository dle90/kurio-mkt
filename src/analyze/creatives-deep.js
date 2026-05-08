// Deep creative pull: every ad with meaningful spend in last 90d, full creative payload
// dumped to creatives-deep-results.json for offline categorization.

import { meta } from '../client.js';
import fs from 'fs';

const DATE_PRESET = process.env.DATE_PRESET || 'last_90d';
const TARGETS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997', name: 'Kurio 3' },
];
const MIN_SPEND = Number(process.env.MIN_SPEND || 1_000_000);

function actVal(arr, type) {
  const a = (arr || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

function stripHash(s) {
  if (!s) return s;
  return s.replace(/\s*\d{4}-\d{2}-\d{2}-[0-9a-f]{16,}\s*$/i, '').replace(/\s+\d{10,}\s*$/, '').trim();
}

function pickText(creative, key) {
  if (creative?.[key]) return creative[key];
  const afs = creative?.asset_feed_spec;
  if (afs) {
    if (key === 'body' && afs.bodies?.[0]?.text) return afs.bodies[0].text;
    if (key === 'title' && afs.titles?.[0]?.text) return afs.titles[0].text;
    if (key === 'description' && afs.descriptions?.[0]?.text) return afs.descriptions[0].text;
  }
  const oss = creative?.object_story_spec;
  if (oss) {
    if (key === 'body') return oss.video_data?.message || oss.link_data?.message;
    if (key === 'title') return oss.link_data?.name;
    if (key === 'description') return oss.link_data?.description;
  }
  if (key === 'body' && creative?.name) return stripHash(creative.name);
  return null;
}

function pickAllBodies(creative) {
  const out = new Set();
  const afs = creative?.asset_feed_spec;
  if (afs?.bodies) for (const b of afs.bodies) if (b?.text) out.add(b.text);
  if (afs?.titles) for (const t of afs.titles) if (t?.text) out.add(`[TITLE] ${t.text}`);
  const oss = creative?.object_story_spec;
  if (oss?.video_data?.message) out.add(oss.video_data.message);
  if (oss?.link_data?.message) out.add(oss.link_data.message);
  if (creative?.body) out.add(creative.body);
  return [...out];
}

function pickCTA(creative) {
  return creative?.call_to_action_type
    || creative?.asset_feed_spec?.call_to_action_types?.[0]
    || creative?.object_story_spec?.video_data?.call_to_action?.type
    || creative?.object_story_spec?.link_data?.call_to_action?.type
    || null;
}

function detectFormat(creative) {
  if (!creative) return 'unknown';
  if (creative.asset_feed_spec) {
    const afs = creative.asset_feed_spec;
    const hasVideo = (afs.videos || []).length > 0;
    const hasImage = (afs.images || []).length > 0;
    return hasVideo ? (hasImage ? 'dynamic-mixed' : 'dynamic-video') : 'dynamic-image';
  }
  const ot = (creative.object_type || '').toUpperCase();
  if (ot === 'VIDEO' || creative.video_id || creative.object_story_spec?.video_data) return 'video';
  if (ot === 'PHOTO' || ot === 'SHARE' || creative.image_url || creative.image_hash) return 'photo';
  if (creative.object_story_id) return 'boosted-post';
  return 'other';
}

async function pullAdInsights(account) {
  // base metrics
  const base = await meta.getAll(`/${account.id}/insights`, {
    level: 'ad',
    date_preset: DATE_PRESET,
    fields: 'ad_id,ad_name,campaign_name,campaign_id,adset_name,adset_id,objective,impressions,clicks,spend,ctr,cpm,frequency,actions',
    limit: 500,
  });
  // video metrics in a separate pass keyed on ad_id
  const video = await meta.getAll(`/${account.id}/insights`, {
    level: 'ad',
    date_preset: DATE_PRESET,
    fields: 'ad_id,video_p25_watched_actions,video_p100_watched_actions,video_play_actions',
    limit: 500,
  });
  const videoMap = new Map();
  for (const v of video) videoMap.set(v.ad_id, v);
  for (const r of base) {
    const v = videoMap.get(r.ad_id);
    if (v) {
      r.video_p25_watched_actions = v.video_p25_watched_actions;
      r.video_p100_watched_actions = v.video_p100_watched_actions;
      r.video_play_actions = v.video_play_actions;
    }
  }
  return base;
}

function rowToMetrics(row, accountName) {
  const spend = Number(row.spend) || 0;
  const impressions = Number(row.impressions) || 0;
  const videoPlays = actVal(row.video_play_actions, 'video_view');
  const p25 = actVal(row.video_p25_watched_actions, 'video_view');
  const p100 = actVal(row.video_p100_watched_actions, 'video_view');
  return {
    account: accountName,
    ad_id: row.ad_id,
    ad_name: row.ad_name,
    campaign: row.campaign_name,
    campaign_id: row.campaign_id,
    adset: row.adset_name,
    adset_id: row.adset_id,
    objective: row.objective,
    spend,
    impressions,
    ctr: Number(row.ctr) || 0,
    cpm: Number(row.cpm) || 0,
    frequency: Number(row.frequency) || 0,
    link_clicks: actVal(row.actions, 'link_click'),
    lpv: actVal(row.actions, 'landing_page_view'),
    registrations: actVal(row.actions, 'complete_registration'),
    leads: actVal(row.actions, 'onsite_conversion.lead_grouped') + actVal(row.actions, 'offsite_conversion.fb_pixel_lead'),
    video_plays: videoPlays,
    video_p25: p25,
    video_p100: p100,
    hook_rate: impressions > 0 ? p25 / impressions : null,
    completion_rate: p25 > 0 ? p100 / p25 : null,
  };
}

async function fetchCreative(adId) {
  try {
    const ad = await meta.get(`/${adId}`, {
      fields: 'name,creative{id,name,body,title,call_to_action_type,asset_feed_spec,object_story_spec,object_story_id,effective_object_story_id,object_type,video_id,image_url,thumbnail_url,url_tags}',
    });
    return ad.creative || null;
  } catch (e) {
    return { error: e.message };
  }
}

console.log(`Pulling deep creative dataset, ${DATE_PRESET}, MIN_SPEND=${MIN_SPEND.toLocaleString()} VND...\n`);
const all = [];
for (const t of TARGETS) {
  const rows = await pullAdInsights(t);
  console.log(`  ${t.name}: ${rows.length} ad rows`);
  for (const r of rows) all.push(rowToMetrics(r, t.name));
}

const significant = all.filter(r => r.spend >= MIN_SPEND);
console.log(`\n${significant.length} ads with spend >= ${MIN_SPEND.toLocaleString()} VND\n`);

console.log(`Fetching creatives (this will take a while)...`);
const enriched = [];
let done = 0;
for (const r of significant) {
  const c = await fetchCreative(r.ad_id);
  enriched.push({
    ...r,
    cpr: r.registrations > 0 ? r.spend / r.registrations : null,
    cplpv: r.lpv > 0 ? r.spend / r.lpv : null,
    cpc_link: r.link_clicks > 0 ? r.spend / r.link_clicks : null,
    creative_id: c?.id || null,
    format: detectFormat(c),
    body: pickText(c, 'body'),
    title: pickText(c, 'title'),
    description: pickText(c, 'description'),
    all_bodies: pickAllBodies(c),
    cta: pickCTA(c),
    thumbnail_url: c?.thumbnail_url || null,
    video_id: c?.video_id || null,
    object_story_id: c?.object_story_id || c?.effective_object_story_id || null,
    url_tags: c?.url_tags || null,
    creative_name: c?.name || null,
  });
  done += 1;
  if (done % 25 === 0) console.log(`  ... ${done}/${significant.length}`);
}

const outPath = 'creatives-deep-results.json';
fs.writeFileSync(outPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  date_preset: DATE_PRESET,
  min_spend: MIN_SPEND,
  count: enriched.length,
  ads: enriched,
}, null, 2));

console.log(`\nWrote ${outPath} with ${enriched.length} ads.\n`);

// quick summary
const fmt = {};
const ctas = {};
const objectives = {};
let withReg = 0, totalSpend = 0, totalReg = 0;
for (const r of enriched) {
  fmt[r.format] = (fmt[r.format] || 0) + 1;
  if (r.cta) ctas[r.cta] = (ctas[r.cta] || 0) + 1;
  if (r.objective) objectives[r.objective] = (objectives[r.objective] || 0) + 1;
  if (r.registrations > 0) withReg += 1;
  totalSpend += r.spend;
  totalReg += r.registrations;
}
console.log('Formats:', fmt);
console.log('CTAs:', ctas);
console.log('Objectives:', objectives);
console.log(`Ads with reg: ${withReg}/${enriched.length}  total spend ${Math.round(totalSpend).toLocaleString()} VND  total reg ${totalReg}  blended CPR ${totalReg > 0 ? Math.round(totalSpend/totalReg).toLocaleString() : 'n/a'} VND`);
