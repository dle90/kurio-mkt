// Pull recent sale_orders with total_amount so we can compute revenue per
// order (not just per account-cohort). Default: last 14 days.
//   SINCE=YYYY-MM-DD UNTIL=YYYY-MM-DD node src/roas/fetch_getfly_orders_recent.js
import 'dotenv/config';
import fs from 'node:fs';
import { getfly } from '../getfly/client.js';

const today = new Date();
const SINCE = process.env.SINCE || new Date(today.getTime() - 14*24*60*60*1000).toISOString().slice(0,10);
const UNTIL = process.env.UNTIL || today.toISOString().slice(0,10);
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
    if (out.length > 20000) { console.log('    safety cap'); break; }
  }
  console.log(`    done: ${out.length} records`);
  return out;
}

const main = async () => {
  console.log(`Fetching sale_orders ${SINCE} → ${UNTIL} (with total_amount)\n`);
  const orders = await pullSince('/sale_orders', FIELDS, SINCE, UNTIL);
  fs.writeFileSync('.cache/getfly_orders_recent.json', JSON.stringify(orders, null, 2));

  // Quick summary — bucket by week, by status, by amount field
  const byWeek = {};
  for (const o of orders) {
    const d = (o.created_at||'').slice(0,10);
    const wk = d <= '2026-05-10' ? '5/4-5/10' : (d <= '2026-05-17' ? '5/11-5/17' : 'other');
    if (!byWeek[wk]) byWeek[wk] = { n: 0, real: 0, face: 0, status: {} };
    byWeek[wk].n++;
    byWeek[wk].real += +o.real_amount || 0;
    byWeek[wk].face += +o.f_amount || 0;
    byWeek[wk].status[o.status_label || o.status] = (byWeek[wk].status[o.status_label || o.status]||0)+1;
  }
  console.log(`\nSaved ${orders.length} orders. Sample order:`);
  console.log('  ', JSON.stringify(orders[0]));
  console.log('\nBy week:');
  for (const [wk,v] of Object.entries(byWeek)) {
    console.log(`  ${wk}: ${v.n} orders  real_amount sum ${Math.round(v.real).toLocaleString()}  f_amount sum ${Math.round(v.face).toLocaleString()}`);
    console.log(`    status: ${JSON.stringify(v.status)}`);
  }
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
