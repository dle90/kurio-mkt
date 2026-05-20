// Fetch daily campaign-level Meta insights for the dashboard (default 60 days).
// Pulls in small time-chunks — a single 60-day daily query is heavy enough that
// Meta intermittently returns error 1/2 ("unknown" / "service unavailable").
// Saves incrementally so partial progress survives a failure.
// Output: .cache/dashboard_daily.json
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
];
const DAYS = +(process.env.DAYS || 60);
const CHUNK = +(process.env.CHUNK || 15);
const iso = d => d.toISOString().slice(0, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const today = new Date();
const until = iso(today);
const since = iso(new Date(today.getTime() - DAYS * 86400_000));

function windows(sinceStr, untilStr, days) {
  const out = [];
  let s = new Date(sinceStr + 'T00:00:00Z');
  const end = new Date(untilStr + 'T00:00:00Z');
  while (s <= end) {
    let e = new Date(s.getTime() + (days - 1) * 86400_000);
    if (e > end) e = end;
    out.push({ since: iso(s), until: iso(e) });
    s = new Date(e.getTime() + 86400_000);
  }
  return out;
}

const main = async () => {
  const wins = windows(since, until, CHUNK);
  console.error(`Fetching daily campaign insights ${since} → ${until} — ${wins.length} chunks × ${ACCOUNTS.length} accounts\n`);
  const rows = [];
  let failed = 0;
  for (const acc of ACCOUNTS) {
    for (const w of wins) {
      let r;
      try {
        r = await meta.getAll(`/${acc.id}/insights`, {
          level: 'campaign',
          fields: 'campaign_id,campaign_name,objective,spend,impressions,clicks,actions',
          time_range: { since: w.since, until: w.until },
          time_increment: 1,
          limit: 500,
        });
      } catch (e) {
        console.error(`  ${acc.name} ${w.since}..${w.until} ERROR: ${e.message}`);
        failed++;
        continue;
      }
      for (const x of r) {
        const reg = (x.actions || []).find(a => a.action_type === 'complete_registration')?.value || 0;
        rows.push({
          account: acc.name, date: x.date_start,
          campaign_id: x.campaign_id, campaign: x.campaign_name, objective: x.objective,
          spend: +x.spend || 0, impressions: +x.impressions || 0, clicks: +x.clicks || 0,
          reg: +reg || 0,
        });
      }
      console.error(`  ${acc.name} ${w.since}..${w.until}: ${r.length} rows`);
      fs.writeFileSync('.cache/dashboard_daily.json', JSON.stringify({ since, until, rows }));
      await sleep(4000);
    }
  }
  console.error(`\nSaved ${rows.length} rows to .cache/dashboard_daily.json (${failed} chunk(s) failed)`);
  if (failed) process.exitCode = 1;
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
