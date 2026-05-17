// Pull Meta YTD spend per ad-name for Kurio 2 + Kurio 3.
// Output: .cache/meta_spend.json — array of { ad_name_norm, spend, impressions, clicks, link_clicks, account }
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
];

// 2026 YTD: Jan 1 → today
const today = new Date().toISOString().slice(0, 10);
const TIME_RANGE = { since: '2026-01-01', until: today };

// Normalize an ad name to its "code" form for joining to sheet utm_content:
// lowercase, trim, strip leading "CVS_", trailing " - Bản sao N", whitespace
export function normalizeName(n) {
  if (!n) return '';
  return n.trim().toLowerCase()
    .replace(/\s*-\s*bản sao\s*\d*\s*$/i, '')
    .replace(/^cvs[_\s-]+/i, '');
}

const main = async () => {
  console.log(`Fetching Meta ad-level insights ${TIME_RANGE.since} → ${TIME_RANGE.until}\n`);
  const allRows = [];

  for (const acc of ACCOUNTS) {
    console.log(`=== ${acc.name} (${acc.id}) ===`);
    let rows;
    try {
      rows = await meta.getAll(`/${acc.id}/insights`, {
        level: 'ad',
        fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,actions',
        time_range: TIME_RANGE,
        limit: 200,
      });
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
      continue;
    }
    console.log(`  ${rows.length} insight rows`);
    for (const r of rows) {
      const linkClicks = (r.actions || []).find(a => a.action_type === 'link_click')?.value || 0;
      allRows.push({
        account: acc.name,
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        ad_name_norm: normalizeName(r.ad_name),
        adset_name: r.adset_name,
        campaign_name: r.campaign_name,
        spend: +r.spend || 0,
        impressions: +r.impressions || 0,
        clicks: +r.clicks || 0,
        link_clicks: +linkClicks || 0,
      });
    }
  }

  fs.writeFileSync('.cache/meta_spend.json', JSON.stringify(allRows, null, 2));
  console.log(`\nTotal: ${allRows.length} ad rows across both accounts`);
  console.log(`Total spend: ${allRows.reduce((s, r) => s + r.spend, 0).toFixed(0)} VND`);
  console.log(`Saved to .cache/meta_spend.json`);

  // Quick sanity check: top 10 ads by spend
  console.log('\nTop 10 ads by spend (YTD):');
  allRows.sort((a, b) => b.spend - a.spend).slice(0, 10).forEach(r => {
    console.log(`  ${(r.spend|0).toString().padStart(10)} VND  ${r.account}  "${r.ad_name}"`);
  });
};

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
