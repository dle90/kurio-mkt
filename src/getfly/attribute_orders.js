// Attribute orders to ad codes using Getfly's own data instead of the Google
// sheet. Each /accounts record carries custom_fields.ads_code (set by the
// LadiPage form at registration). We join:
//   order.account_phone  ->  /accounts?search=<phone>  ->  custom_fields.ads_code
//
// Exports lookupAccount() + attributeOrders() for reuse (daily report).
// CLI:  node src/getfly/attribute_orders.js [YYYY-MM-DD]   (default: yesterday)
import 'dotenv/config';
import fs from 'node:fs';
import { getfly } from '../getfly/client.js';

export const normPhone = s => { if (!s) return ''; const d = String(s).replace(/[^\d]/g, ''); if (d.startsWith('84') && (d.length === 11 || d.length === 12)) return '0' + d.slice(2); if (d.length === 9) return '0' + d; if (d.length === 10 && d.startsWith('0')) return d; if (d.length === 10) return '0' + d.slice(1); return d; };
const fmt = n => Math.round(n).toLocaleString('en-US');

// account_source decode (observed): 31 = Meta/ads, 7 = organic page, 5 = renewal
const SRC = { 31: 'ads', 7: 'organic-page', 5: 'renewal' };

const _cache = new Map();
export async function lookupAccount(phone) {
  const p = normPhone(phone);
  if (!p) return null;
  if (_cache.has(p)) return _cache.get(p);
  let acc = null;
  try {
    const r = await getfly.get('/accounts', {
      search: p, limit: 5,
      fields: 'id,account_name,phone_office,account_source,created_at,custom_fields',
    });
    const matches = (r?.data || []).filter(a => normPhone(a.phone_office) === p);
    matches.sort((a, b) => (b.custom_fields?.ads_code ? 1 : 0) - (a.custom_fields?.ads_code ? 1 : 0));
    acc = matches[0] || null;
  } catch (e) { console.error(`  search ${p} ERR: ${e.message.slice(0, 80)}`); }
  _cache.set(p, acc);
  return acc;
}

// Returns one row per order: { order, phone, amount, account_id, ads_code, source, note }
export async function attributeOrders(orders) {
  const rows = [];
  for (const o of orders) {
    const acc = await lookupAccount(o.account_phone);
    const cf = acc?.custom_fields || {};
    const srcId = Array.isArray(acc?.account_source) ? acc.account_source[0] : null;
    const note = (cf.note_phu_huynh || '').toLowerCase();
    let bucket;
    if ((cf.ads_code || '').trim()) bucket = 'ad';
    else if (!acc) bucket = 'no-account';
    else if (/gia\s*h[aạ]n|h[aạ]n\s*\d/.test(note) || srcId === 5) bucket = 'renewal';
    else if (srcId === 7) bucket = 'organic-page';
    else bucket = 'other';
    rows.push({
      order: o.order_code, phone: normPhone(o.account_phone), amount: +o.real_amount || 0,
      account_id: acc?.id || null, ads_code: (cf.ads_code || '').trim() || null,
      bucket, source: SRC[srcId] || (srcId == null ? '(none)' : 'src' + srcId),
      note: (cf.note_phu_huynh || '').slice(0, 40), acct_created: (acc?.created_at || '').slice(0, 10),
    });
  }
  return rows;
}

// ---- CLI ----
const isCli = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isCli) {
  const DAY = process.argv[2] || new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const orders = JSON.parse(fs.readFileSync('.cache/daily_orders.json', 'utf8'))
    .filter(o => o.status === 2 && (o.created_at || '').slice(0, 10) === DAY && (+o.real_amount || 0) > 0);
  console.error(`Re-attributing ${orders.length} approved orders for ${DAY} via Getfly ads_code...\n`);
  const rows = await attributeOrders(orders);
  const P = s => console.log(s);
  P('='.repeat(78));
  P(`  ORDER ATTRIBUTION via Getfly ads_code — ${DAY}`);
  P('='.repeat(78));
  for (const r of rows) {
    P('  ' + r.order.padEnd(9) + ' ' + r.phone.padEnd(12) + ' ' + fmt(r.amount).padStart(10) + '  ' +
      (r.ads_code || '—').padEnd(18) + ' ' + r.bucket.padEnd(13) + ' ' + r.note);
  }
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const byCode = new Map(), byBucket = new Map();
  for (const r of rows) {
    byBucket.set(r.bucket, (byBucket.get(r.bucket) || 0) + r.amount);
    if (r.ads_code) byCode.set(r.ads_code, (byCode.get(r.ads_code) || 0) + r.amount);
  }
  P(`\n  Total approved revenue ${DAY}: ${fmt(total)} VND (${rows.length} orders)`);
  for (const [b, a] of [...byBucket.entries()].sort((x, y) => y[1] - x[1]))
    P(`    ${b.padEnd(14)} ${fmt(a).padStart(12)} VND  (${Math.round(a / total * 100)}%)`);
  P('\n  Revenue by ad code:');
  for (const [c, a] of [...byCode.entries()].sort((x, y) => y[1] - x[1]))
    P('    ' + c.padEnd(20) + fmt(a).padStart(12) + ' VND');
  fs.writeFileSync(`.cache/order_attrib_${DAY}.json`, JSON.stringify(rows, null, 2));
  console.error(`\nSaved .cache/order_attrib_${DAY}.json`);
}
