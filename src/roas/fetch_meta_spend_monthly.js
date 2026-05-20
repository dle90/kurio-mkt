// Pull Meta YTD spend per ad-name BROKEN OUT BY MONTH for Kurio 2 + Kurio 3.
// Same as fetch_meta_spend.js but with time_increment=monthly.
// Output: .cache/meta_spend_monthly.json — one row per (ad, month).
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
];
const today = new Date().toISOString().slice(0, 10);
const TIME_RANGE = { since: '2026-01-01', until: today };

export function normalizeName(n) {
  if (!n) return '';
  return n.trim().toLowerCase()
    .replace(/\s*-\s*bản sao\s*\d*\s*$/i, '')
    .replace(/^cvs[_\s-]+/i, '');
}

const main = async () => {
  console.log(`Fetching MONTHLY Meta ad-level insights ${TIME_RANGE.since} → ${TIME_RANGE.until}\n`);
  const allRows = [];
  for (const acc of ACCOUNTS) {
    console.log(`=== ${acc.name} (${acc.id}) ===`);
    let rows;
    try {
      rows = await meta.getAll(`/${acc.id}/insights`, {
        level: 'ad',
        fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,actions',
        time_range: TIME_RANGE,
        time_increment: 'monthly',
        limit: 500,
      });
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
      continue;
    }
    console.log(`  ${rows.length} (ad, month) rows`);
    for (const r of rows) {
      const linkClicks = (r.actions || []).find(a => a.action_type === 'link_click')?.value || 0;
      const regs = (r.actions || []).find(a => a.action_type === 'complete_registration')?.value || 0;
      allRows.push({
        account: acc.name,
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        ad_name_norm: normalizeName(r.ad_name),
        adset_name: r.adset_name,
        campaign_name: r.campaign_name,
        date_start: r.date_start,
        date_stop: r.date_stop,
        month: (r.date_start || '').slice(0, 7),
        spend: +r.spend || 0,
        impressions: +r.impressions || 0,
        clicks: +r.clicks || 0,
        link_clicks: +linkClicks || 0,
        registrations: +regs || 0,
      });
    }
  }
  fs.writeFileSync('.cache/meta_spend_monthly.json', JSON.stringify(allRows, null, 2));
  const monthlyTot = new Map();
  for (const r of allRows) monthlyTot.set(r.month, (monthlyTot.get(r.month)||0) + r.spend);
  console.log(`\nTotal: ${allRows.length} (ad, month) rows  ${[...new Set(allRows.map(r=>r.ad_id))].size} unique ads`);
  console.log('\nSpend by month:');
  [...monthlyTot.entries()].sort().forEach(([m,v]) => console.log(`  ${m}: ${Math.round(v).toLocaleString()} VND`));
  console.log('\nSaved to .cache/meta_spend_monthly.json');
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
