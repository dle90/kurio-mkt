// Lighter version of fetch_meta_spend_recent: pulls last 14 days but with
// time_increment=7 (2 weekly rows per ad instead of 14 daily rows).
// Output: .cache/meta_spend_recent.json (same path as the daily fetcher).
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
];

// Allow explicit override via env (SINCE / UNTIL = YYYY-MM-DD). Defaults to
// today and today-13d (trailing 14d window).
const today = new Date();
const until = process.env.UNTIL || today.toISOString().slice(0,10);
const since = process.env.SINCE || new Date(today.getTime() - 13*24*60*60*1000).toISOString().slice(0,10);

export function normalizeName(n) {
  if (!n) return '';
  return n.trim().toLowerCase()
    .replace(/\s*-\s*bản sao\s*\d*\s*$/i, '')
    .replace(/^cvs[_\s-]+/i, '');
}

const main = async () => {
  console.log(`Fetching WEEKLY Meta insights ${since} → ${until} (14d window, time_increment=7)\n`);
  const allRows = [];
  for (const acc of ACCOUNTS) {
    console.log(`=== ${acc.name} ===`);
    let rows;
    try {
      rows = await meta.getAll(`/${acc.id}/insights`, {
        level: 'ad',
        fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,actions',
        time_range: { since, until },
        time_increment: 7,
        limit: 500,
      });
    } catch (e) { console.log('  ERROR:', e.message); continue; }
    console.log(`  ${rows.length} (ad, week) rows`);
    for (const r of rows) {
      const findAct = t => (r.actions || []).find(a => a.action_type === t)?.value || 0;
      allRows.push({
        account: acc.name,
        ad_id: r.ad_id, ad_name: r.ad_name,
        ad_name_norm: normalizeName(r.ad_name),
        adset_name: r.adset_name, campaign_name: r.campaign_name,
        date: r.date_start,
        date_start: r.date_start,
        date_stop: r.date_stop,
        spend: +r.spend || 0, impressions: +r.impressions || 0,
        clicks: +r.clicks || 0,
        link_clicks: +findAct('link_click') || 0,
        registrations: +findAct('complete_registration') || 0,
      });
    }
  }
  fs.writeFileSync('.cache/meta_spend_recent.json', JSON.stringify(allRows, null, 2));

  // Quick summary
  const byWeek = new Map();
  for (const r of allRows) byWeek.set(r.date_start, (byWeek.get(r.date_start)||0) + r.spend);
  console.log(`\nSaved ${allRows.length} (ad, week) rows. Spend by week:`);
  [...byWeek.entries()].sort().forEach(([w, s]) => console.log(`  week starting ${w}: ${Math.round(s).toLocaleString()} VND`));
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
