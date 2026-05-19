import { meta } from '../client.js';

const DATE_PRESET = process.env.DATE_PRESET || 'last_90d';
const TARGETS = meta.targets;
const MIN_SPEND = 500_000;
const TOP_N = 15;

function actVal(arr, type) {
  const a = (arr || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

async function pullAdInsights(account) {
  return meta.getAll(`/${account.id}/insights`, {
    level: 'ad',
    date_preset: DATE_PRESET,
    fields: 'ad_id,ad_name,campaign_name,adset_name,impressions,clicks,spend,ctr,cpc,cpm,frequency,actions',
    limit: 500,
  });
}

function rowToMetrics(row, accountName) {
  const spend = Number(row.spend) || 0;
  return {
    account: accountName,
    ad_id: row.ad_id,
    ad_name: row.ad_name,
    campaign: row.campaign_name,
    adset: row.adset_name,
    spend,
    impressions: Number(row.impressions) || 0,
    ctr: Number(row.ctr) || 0,
    link_clicks: actVal(row.actions, 'link_click'),
    lpv: actVal(row.actions, 'landing_page_view'),
    registrations: actVal(row.actions, 'complete_registration'),
    leads: actVal(row.actions, 'onsite_conversion.lead_grouped') + actVal(row.actions, 'offsite_conversion.fb_pixel_lead'),
  };
}

function stripCreativeNameHash(s) {
  if (!s) return s;
  return s.replace(/\s*\d{4}-\d{2}-\d{2}-[0-9a-f]{16,}\s*$/i, '').replace(/\s+\d{10,}\s*$/, '').trim();
}

function pickText(creative, key) {
  if (creative?.[key]) return creative[key];
  const afs = creative?.asset_feed_spec;
  if (afs) {
    if (key === 'body' && afs.bodies?.[0]?.text) return afs.bodies[0].text;
    if (key === 'title' && afs.titles?.[0]?.text) return afs.titles[0].text;
  }
  const oss = creative?.object_story_spec;
  if (oss) {
    if (key === 'body') return oss.video_data?.message || oss.link_data?.message;
    if (key === 'title') return oss.link_data?.name;
  }
  if (key === 'body' && creative?.name) return stripCreativeNameHash(creative.name);
  return null;
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

console.log(`Pulling ad-level insights, ${DATE_PRESET}...\n`);
const all = [];
for (const t of TARGETS) {
  const rows = await pullAdInsights(t);
  console.log(`  ${t.name}: ${rows.length} ad rows`);
  for (const r of rows) all.push(rowToMetrics(r, t.name));
}

const significant = all.filter(r => r.spend >= MIN_SPEND);
console.log(`\n${significant.length} ads with spend >= ${MIN_SPEND.toLocaleString()} VND\n`);

const withReg = significant.filter(r => r.registrations > 0).map(r => ({ ...r, cpr: r.spend / r.registrations }));
const noReg = significant.filter(r => r.registrations === 0);

const topByCpr = [...withReg].sort((a, b) => a.cpr - b.cpr).slice(0, TOP_N);
const bottomByCpr = [...withReg].sort((a, b) => b.cpr - a.cpr).slice(0, TOP_N);
const worstNoReg = [...noReg].sort((a, b) => b.spend - a.spend).slice(0, TOP_N);

console.log(`Fetching creatives for ${topByCpr.length + bottomByCpr.length + worstNoReg.length} ads...\n`);

async function enrich(rows) {
  const out = [];
  for (const r of rows) {
    const c = await fetchCreative(r.ad_id);
    out.push({
      ...r,
      creative: c,
      format: detectFormat(c),
      body: pickText(c, 'body'),
      title: pickText(c, 'title'),
      description: pickText(c, 'description'),
      cta: pickCTA(c),
    });
  }
  return out;
}

const top = await enrich(topByCpr);
const bottom = await enrich(bottomByCpr);
const sinks = await enrich(worstNoReg);

function printGroup(label, rows) {
  console.log(`\n${'='.repeat(80)}\n${label}\n${'='.repeat(80)}\n`);
  for (const r of rows) {
    const cprStr = r.cpr ? Math.round(r.cpr).toLocaleString() + ' VND' : '(no reg)';
    console.log(`[${r.account}] ${r.ad_name}`);
    console.log(`  campaign: ${r.campaign}`);
    console.log(`  spend: ${Math.round(r.spend).toLocaleString()} VND  reg: ${r.registrations}  CPR: ${cprStr}  ctr: ${r.ctr.toFixed(2)}%  lpv: ${r.lpv}`);
    console.log(`  format: ${r.format}  CTA: ${r.cta || '(none)'}`);
    if (r.title) console.log(`  TITLE: ${String(r.title).replace(/\s+/g, ' ').slice(0, 120)}`);
    if (r.body) {
      const body = String(r.body).replace(/\s+/g, ' ');
      console.log(`  BODY (${body.length} chars): ${body.slice(0, 280)}${body.length > 280 ? '…' : ''}`);
    }
    if (r.creative?.thumbnail_url) console.log(`  thumb: ${r.creative.thumbnail_url.slice(0, 100)}...`);
    if (r.creative?.url_tags) console.log(`  url_tags: ${r.creative.url_tags}`);
    console.log();
  }
}

printGroup(`TOP ${TOP_N} ADS BY CPR (best — most efficient at producing registrations)`, top);
printGroup(`BOTTOM ${TOP_N} ADS BY CPR (got registrations but expensive)`, bottom);
printGroup(`TOP ${TOP_N} SPEND WITH ZERO REGISTRATIONS (money sinks)`, sinks);

function patternStats(label, rows) {
  if (!rows.length) return;
  const fmtCount = {};
  const ctaCount = {};
  let totalBodyLen = 0, withBody = 0;
  let hasEmoji = 0, hasQuestionMark = 0, hasNumber = 0, hasPrice = 0;
  for (const r of rows) {
    fmtCount[r.format] = (fmtCount[r.format] || 0) + 1;
    if (r.cta) ctaCount[r.cta] = (ctaCount[r.cta] || 0) + 1;
    if (r.body) {
      const b = String(r.body);
      totalBodyLen += b.length;
      withBody += 1;
      if (/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(b)) hasEmoji += 1;
      if (b.includes('?')) hasQuestionMark += 1;
      if (/\d/.test(b)) hasNumber += 1;
      if (/(\d[\d\.,]*\s*(k|nghìn|nghin|đ|vnd|d|VND))/i.test(b)) hasPrice += 1;
    }
  }
  console.log(`\n--- patterns: ${label} (n=${rows.length}) ---`);
  console.log(`  formats: ${JSON.stringify(fmtCount)}`);
  console.log(`  CTAs: ${JSON.stringify(ctaCount)}`);
  console.log(`  avg body length: ${withBody > 0 ? Math.round(totalBodyLen / withBody) : 'n/a'} chars`);
  console.log(`  body contains emoji: ${hasEmoji}/${withBody}`);
  console.log(`  body contains '?': ${hasQuestionMark}/${withBody}`);
  console.log(`  body contains number: ${hasNumber}/${withBody}`);
  console.log(`  body mentions price: ${hasPrice}/${withBody}`);
}

console.log(`\n${'='.repeat(80)}\nAGGREGATE PATTERNS\n${'='.repeat(80)}`);
patternStats('TOP performers', top);
patternStats('BOTTOM performers (with reg)', bottom);
patternStats('SINKS (zero reg)', sinks);
