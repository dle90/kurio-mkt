// Pull two weeks of Meta spend (last 7 days + prior 7 days) per ad×day.
// Output: .cache/meta_spend_recent.json
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
];

const today = new Date();
const until = today.toISOString().slice(0,10);
const since = new Date(today.getTime() - 14*24*60*60*1000).toISOString().slice(0,10);

export function normalizeName(n) {
  if (!n) return '';
  return n.trim().toLowerCase()
    .replace(/\s*-\s*bản sao\s*\d*\s*$/i, '')
    .replace(/^cvs[_\s-]+/i, '');
}

const main = async () => {
  console.log(`Fetching DAILY Meta insights ${since} → ${until} (14d window)\n`);
  const allRows = [];
  for (const acc of ACCOUNTS) {
    console.log(`=== ${acc.name} ===`);
    let rows;
    try {
      rows = await meta.getAll(`/${acc.id}/insights`, {
        level: 'ad',
        fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,actions',
        time_range: { since, until },
        time_increment: 1,
        limit: 500,
      });
    } catch (e) { console.log('  ERROR:', e.message); continue; }
    console.log(`  ${rows.length} ad-day rows`);
    for (const r of rows) {
      const linkClicks = (r.actions || []).find(a => a.action_type === 'link_click')?.value || 0;
      allRows.push({
        account: acc.name,
        ad_id: r.ad_id, ad_name: r.ad_name,
        ad_name_norm: normalizeName(r.ad_name),
        adset_name: r.adset_name, campaign_name: r.campaign_name,
        date: r.date_start,
        spend: +r.spend || 0, impressions: +r.impressions || 0,
        clicks: +r.clicks || 0, link_clicks: +linkClicks || 0,
      });
    }
  }
  fs.writeFileSync('.cache/meta_spend_recent.json', JSON.stringify(allRows, null, 2));
  console.log(`\nSaved ${allRows.length} ad-day rows to .cache/meta_spend_recent.json`);
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
