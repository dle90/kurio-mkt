// Pull YTD sale_orders with real_amount for order-based revenue attribution.
// Replaces the account.total_revenue cohort method (which double-counts
// lifetime value into the month of account creation instead of crediting
// revenue to the actual order month).
//   node src/roas/fetch_getfly_orders_ytd.js
import 'dotenv/config';
import fs from 'node:fs';
import { getfly } from '../getfly/client.js';

const SINCE = process.env.SINCE || '2026-01-01';
const UNTIL = process.env.UNTIL || new Date().toISOString().slice(0,10);
const FIELDS = 'id,order_code,account_id,account_code,account_phone,real_amount,f_amount,status,status_label,order_date,created_at,src_name';

async function pullSince(path, fields, since, until) {
  console.log(`  ${path} (paginate id-DESC until created_at < ${since})...`);
  const out = [];
  let offset = 0;
  while (true) {
    const r = await getfly.get(path, { limit: 200, offset, fields });
    const data = r?.data || [];
    if (!data.length) break;
    let stopped = false;
    for (const rec of data) {
      const d = (rec.created_at||'').slice(0,10);
      if (d && d < since) { stopped = true; break; }
      if (d && d > until) continue;
      out.push(rec);
    }
    if (stopped) break;
    if (!r.has_more) break;
    offset += data.length;
    if (out.length % 500 === 0) process.stdout.write(`    pulled ${out.length}\n`);
    if (out.length > 50000) { console.log('    safety cap'); break; }
  }
  console.log(`    done: ${out.length} records`);
  return out;
}

const main = async () => {
  console.log(`Fetching YTD sale_orders ${SINCE} → ${UNTIL}\n`);
  const orders = await pullSince('/sale_orders', FIELDS, SINCE, UNTIL);
  fs.writeFileSync('.cache/getfly_orders_ytd.json', JSON.stringify(orders, null, 2));

  // Summary by month, status
  const byMonth = {};
  let approved = 0, cancelled = 0, other = 0;
  for (const o of orders) {
    const m = (o.created_at||'').slice(0,7);
    if (!byMonth[m]) byMonth[m] = { n:0, real:0, status:{} };
    byMonth[m].n++;
    if (o.status === 2) { byMonth[m].real += +o.real_amount || 0; approved++; }
    else if (o.status_label === 'Đã hủy') cancelled++;
    else other++;
    byMonth[m].status[o.status_label || o.status] = (byMonth[m].status[o.status_label || o.status]||0)+1;
  }
  console.log(`\nSaved ${orders.length} orders.  approved=${approved}  cancelled=${cancelled}  other=${other}`);
  console.log('By month (approved real_amount only):');
  for (const m of Object.keys(byMonth).sort()) {
    const v = byMonth[m];
    console.log(`  ${m}: ${v.n} orders  real_amount ${Math.round(v.real).toLocaleString()}  status ${JSON.stringify(v.status)}`);
  }
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
