// Pull Getfly accounts + sale_orders for 2026 YTD.
// Getfly v6 rejects all date-filter params, so we paginate id-DESC and stop when we drop below 2026.
import 'dotenv/config';
import fs from 'node:fs';
import { getfly } from '../getfly/client.js';

const SINCE = '2026-01-01';
const ACCOUNT_FIELDS = 'id,account_name,account_code,phone_office,email,account_type,account_source,created_at,total_revenue';
const ORDER_FIELDS   = 'id,account_id,account_code,status,created_at';

export function normPhone(s) {
  if (!s) return '';
  const digits = String(s).replace(/[^\d]/g, '');
  if (digits.startsWith('84') && digits.length === 11) return '0' + digits.slice(2);
  if (digits.startsWith('84') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 9) return '0' + digits;
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 10) return '0' + digits.slice(1);
  return digits;
}

async function pullSince(path, fields, since) {
  console.log(`  ${path} (paginate id-DESC until created_at < ${since})...`);
  const out = [];
  let offset = 0;
  while (true) {
    const r = await getfly.get(path, { limit: 200, offset, fields });
    const data = r?.data || [];
    if (!data.length) break;
    let stopped = false;
    for (const rec of data) {
      if (rec.created_at && rec.created_at < since) { stopped = true; break; }
      out.push(rec);
    }
    if (stopped) break;
    if (!r.has_more) break;
    offset += data.length;
    if (out.length % 1000 === 0) process.stdout.write(`    pulled ${out.length}\n`);
    if (out.length > 50000) { console.log('    safety cap @50k'); break; }
  }
  console.log(`    done: ${out.length} records`);
  return out;
}

const main = async () => {
  console.log(`Fetching Getfly data since ${SINCE} (client-side filter)\n`);

  const accounts = await pullSince('/accounts', ACCOUNT_FIELDS, SINCE);
  const saleOrders = await pullSince('/sale_orders', ORDER_FIELDS, SINCE);

  // Phone → account_id
  const phoneToAccountId = {};
  for (const a of accounts) {
    const p = normPhone(a.phone_office);
    if (p && !phoneToAccountId[p]) phoneToAccountId[p] = a.id;
  }

  // Paying account_ids (status 2 = paid; status 5 = ? -- include both for now, flag count separately)
  const paidAccountIds = new Set();
  const refundedAccountIds = new Set();
  for (const o of saleOrders) {
    if (o.account_id) {
      if (o.status === 2) paidAccountIds.add(o.account_id);
      if (o.status === 5) refundedAccountIds.add(o.account_id);
    }
  }

  // Phones that paid
  const accountIdToPhone = {};
  const paidPhones = new Set();
  for (const a of accounts) {
    const p = normPhone(a.phone_office);
    if (!p) continue;
    accountIdToPhone[a.id] = p;
    if (paidAccountIds.has(a.id)) paidPhones.add(p);
  }

  // Status dist among YTD orders
  const statusDist = {};
  for (const o of saleOrders) statusDist[o.status] = (statusDist[o.status] || 0) + 1;

  // Sale-order counts per account_id (to gauge repeat purchases)
  const ordersPerAccount = new Map();
  for (const o of saleOrders) ordersPerAccount.set(o.account_id, (ordersPerAccount.get(o.account_id) || 0) + 1);
  const repeatCount = [...ordersPerAccount.values()].filter(c => c > 1).length;

  console.log('\n=== YTD summary ===');
  console.log(`  accounts created in YTD:     ${accounts.length}`);
  console.log(`  sale_orders created in YTD:  ${saleOrders.length}`);
  console.log(`  status distribution:         ${JSON.stringify(statusDist)}`);
  console.log(`  unique paid accounts (st=2): ${paidAccountIds.size}`);
  console.log(`  unique refunded (st=5):      ${refundedAccountIds.size}`);
  console.log(`  unique paying phones:        ${paidPhones.size}`);
  console.log(`  accounts with repeat orders: ${repeatCount}`);

  fs.writeFileSync('.cache/getfly.json', JSON.stringify({
    summary: {
      accounts: accounts.length,
      sale_orders: saleOrders.length,
      statusDist,
      paid_account_ids: paidAccountIds.size,
      paying_phones: paidPhones.size,
    },
    accounts,
    saleOrders,
    phoneToAccountId,
    accountIdToPhone,
    paidPhones: [...paidPhones],
    paidAccountIds: [...paidAccountIds],
    refundedAccountIds: [...refundedAccountIds],
  }, null, 2));
  console.log('\nSaved to .cache/getfly.json');
};

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
