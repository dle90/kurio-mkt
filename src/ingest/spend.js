// Ingest Meta ad-level daily insights into the db (campaigns, ads, spend_daily).
// Re-runnable: every row is an upsert keyed on its natural key, so re-ingesting
// a date range just refreshes it.
//
//   npm run db:ingest-spend                 # last 90 days
//   SINCE=2026-04-01 UNTIL=2026-05-10 npm run db:ingest-spend
//
// Codes are derived from ad names via src/lib/normalize.js. Run db:roas
// afterwards to see code coverage.

import 'dotenv/config';
import { meta } from '../client.js';
import { db, close } from '../db/connection.js';
import { extractCode } from '../lib/normalize.js';

const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const SINCE = process.env.SINCE || daysAgo(90);
const UNTIL = process.env.UNTIL || iso(new Date());
// Ad-level + time_increment=1 over a long range makes Meta return error 1/2
// ("unknown error"). Pull in chunks of CHUNK_DAYS to keep each call small.
const CHUNK_DAYS = Number(process.env.CHUNK_DAYS || 7);

/** Yield [since, until] ISO pairs covering SINCE..UNTIL in CHUNK_DAYS windows. */
function* dateChunks(since, until, days) {
  const end = new Date(until + 'T00:00:00Z');
  let cur = new Date(since + 'T00:00:00Z');
  while (cur <= end) {
    const chunkEnd = new Date(cur);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + days - 1);
    yield [iso(cur), iso(chunkEnd < end ? chunkEnd : end)];
    cur = new Date(chunkEnd);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

const actVal = (actions, type) => {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
};

const conn = db();

const upsertCampaignMeta = conn.prepare(`
  INSERT INTO campaigns (campaign_id, account_id, account_name, name, objective, status, created_time, synced_at)
  VALUES (?,?,?,?,?,?,?,?)
  ON CONFLICT(campaign_id) DO UPDATE SET
    account_name=excluded.account_name, name=excluded.name, objective=excluded.objective,
    status=excluded.status, created_time=excluded.created_time, synced_at=excluded.synced_at`);

// Minimal campaign row for any campaign_id seen in insights but missing from
// the campaigns endpoint (deleted campaigns still have historical insights).
const ensureCampaign = conn.prepare(`
  INSERT INTO campaigns (campaign_id, account_id, account_name, name, synced_at)
  VALUES (?,?,?,?,?) ON CONFLICT(campaign_id) DO NOTHING`);

const upsertAd = conn.prepare(`
  INSERT INTO ads (ad_id, campaign_id, adset_id, adset_name, name, code, synced_at)
  VALUES (?,?,?,?,?,?,?)
  ON CONFLICT(ad_id) DO UPDATE SET
    campaign_id=excluded.campaign_id, adset_id=excluded.adset_id, adset_name=excluded.adset_name,
    name=excluded.name, code=excluded.code, synced_at=excluded.synced_at`);

const upsertSpend = conn.prepare(`
  INSERT INTO spend_daily (ad_id, date, spend, impressions, clicks, link_clicks,
                           landing_page_views, registrations, leads_meta)
  VALUES (?,?,?,?,?,?,?,?,?)
  ON CONFLICT(ad_id, date) DO UPDATE SET
    spend=excluded.spend, impressions=excluded.impressions, clicks=excluded.clicks,
    link_clicks=excluded.link_clicks, landing_page_views=excluded.landing_page_views,
    registrations=excluded.registrations, leads_meta=excluded.leads_meta`);

const logIngest = conn.prepare(`INSERT INTO ingest_log (source, ran_at, detail) VALUES (?,?,?)`);

async function ingestAccount(t) {
  const now = new Date().toISOString();

  // Campaign metadata (objective/status/created_time).
  const campaigns = await meta.getAll(`/${t.id}/campaigns`, {
    fields: 'id,name,objective,effective_status,created_time',
    limit: 200,
  });
  for (const c of campaigns) {
    upsertCampaignMeta.run(c.id, t.id, t.name, c.name || null, c.objective || null,
      c.effective_status || null, c.created_time || null, now);
  }

  // Ad-level daily insights, pulled in date chunks (see CHUNK_DAYS).
  const rows = [];
  for (const [since, until] of dateChunks(SINCE, UNTIL, CHUNK_DAYS)) {
    const chunk = await meta.getAll(`/${t.id}/insights`, {
      level: 'ad',
      time_range: { since, until },
      time_increment: 1,
      fields: 'date_start,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,' +
              'spend,impressions,clicks,actions',
      limit: 500,
    });
    rows.push(...chunk);
  }

  let adCount = 0;
  const seenAds = new Set();
  conn.exec('BEGIN');
  try {
    for (const r of rows) {
      if (!r.ad_id) continue;
      ensureCampaign.run(r.campaign_id, t.id, t.name, r.campaign_name || null, now);
      if (!seenAds.has(r.ad_id)) {
        upsertAd.run(r.ad_id, r.campaign_id || null, r.adset_id || null,
          r.adset_name || null, r.ad_name || null, extractCode(r.ad_name), now);
        seenAds.add(r.ad_id);
        adCount++;
      }
      upsertSpend.run(
        r.ad_id, r.date_start,
        Number(r.spend) || 0,
        Number(r.impressions) || 0,
        Number(r.clicks) || 0,
        actVal(r.actions, 'link_click'),
        actVal(r.actions, 'landing_page_view'),
        actVal(r.actions, 'complete_registration'),
        actVal(r.actions, 'onsite_conversion.lead_grouped') +
          actVal(r.actions, 'offsite_conversion.fb_pixel_lead'),
      );
    }
    conn.exec('COMMIT');
  } catch (e) {
    conn.exec('ROLLBACK');
    throw e;
  }

  console.log(`  ${t.name}: ${campaigns.length} campaigns, ${adCount} ads, ${rows.length} ad-day rows`);
  return { account: t.name, campaigns: campaigns.length, ads: adCount, rows: rows.length };
}

console.log(`Ingesting Meta spend ${SINCE} .. ${UNTIL} for ${meta.targets.length} accounts`);
const summary = [];
for (const t of meta.targets) {
  summary.push(await ingestAccount(t));
}

logIngest.run('spend', new Date().toISOString(),
  JSON.stringify({ since: SINCE, until: UNTIL, accounts: summary }));

const totals = conn.prepare(`
  SELECT COUNT(*) ads, SUM(code IS NULL) no_code FROM ads`).get();
const spendTot = conn.prepare(`SELECT COUNT(*) rows, ROUND(SUM(spend)) spend FROM spend_daily`).get();
console.log(`\nDB now holds ${totals.ads} ads (${totals.no_code} without a code), ` +
  `${spendTot.rows} ad-day rows, ${Number(spendTot.spend).toLocaleString()} VND total spend`);
close();
