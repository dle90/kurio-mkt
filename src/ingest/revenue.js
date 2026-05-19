// Ingest revenue/orders into the `revenue` table, joined to leads on phone.
//
// Two sources, pick whichever is ready:
//   1. CRM API  — set CRM_API_URL (+ CRM_API_KEY) in .env, then: npm run db:ingest-revenue
//   2. A file   — npm run db:ingest-revenue -- path/to/orders.xlsx
//
// Re-runnable: rows are upserted on order_id.

import 'dotenv/config';
import { db, close } from '../db/connection.js';
import { readRows, matchColumn, toIsoDate } from '../lib/sheet.js';
import { normalizePhone } from '../lib/normalize.js';

// ---------------------------------------------------------------------------
// Source 1: CRM API.  <<< FILL IN once the CRM endpoint + auth are known. >>>
// Expected to return an array of orders; map each to the shape in `upsert`.
// ---------------------------------------------------------------------------
async function fetchFromCrm() {
  const base = process.env.CRM_API_URL;
  const key = process.env.CRM_API_KEY;
  if (!base) {
    throw new Error(
      'CRM_API_URL not set. Either configure the CRM API in .env, or pass a file:\n' +
      '  npm run db:ingest-revenue -- path/to/orders.xlsx');
  }
  // TODO: replace with the real CRM request once documented. Likely shape:
  //   const res = await fetch(`${base}/orders?since=...`, {
  //     headers: { Authorization: `Bearer ${key}` } });
  //   const json = await res.json();
  //   return json.data.map(o => ({
  //     order_id: o.id, phone: o.customer_phone, amount: o.total,
  //     order_date: o.created_at, package: o.product, status: o.status, raw: o,
  //   }));
  throw new Error('CRM fetch not implemented yet — wire up fetchFromCrm() in src/ingest/revenue.js');
}

// ---------------------------------------------------------------------------
// Source 2: a spreadsheet export (stop-gap until the CRM API is wired up).
// ---------------------------------------------------------------------------
function fetchFromFile(file) {
  const { sheet, rows } = readRows(file, process.env.REVENUE_SHEET);
  if (!rows.length) throw new Error(`Sheet "${sheet}" is empty`);
  const h = Object.keys(rows[0]);
  const col = {
    order:   process.env.REVENUE_COL_ORDER   || matchColumn(h, /order.?id|ma don|^id$/),
    phone:   process.env.REVENUE_COL_PHONE   || matchColumn(h, /phone|sdt|so dt|dien thoai/),
    amount:  process.env.REVENUE_COL_AMOUNT  || matchColumn(h, /amount|doanh thu|gia tri|total|tien/),
    date:    process.env.REVENUE_COL_DATE    || matchColumn(h, /date|ngay|thoi gian/),
    package: process.env.REVENUE_COL_PACKAGE || matchColumn(h, /package|goi|san pham/),
    status:  process.env.REVENUE_COL_STATUS  || matchColumn(h, /status|trang thai/),
  };
  console.log(`Reading "${sheet}" — ${rows.length} rows. Column mapping:`);
  for (const [k, v] of Object.entries(col)) console.log(`  ${k.padEnd(8)} -> ${v || '(none)'}`);
  if (!col.phone || !col.amount) {
    throw new Error('Need at least a phone and an amount column. Set REVENUE_COL_PHONE / REVENUE_COL_AMOUNT.');
  }
  const num = v => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    return Number(String(v).replace(/[^\d.-]/g, '')) || 0;
  };
  return rows.map((r, i) => ({
    order_id: col.order ? (r[col.order] == null ? null : String(r[col.order])) : `file:${file}:${i + 2}`,
    phone: r[col.phone],
    amount: num(r[col.amount]),
    order_date: col.date ? toIsoDate(r[col.date]) : null,
    package: col.package ? r[col.package] : null,
    status: col.status ? r[col.status] : null,
    raw: r,
  }));
}

// ---------------------------------------------------------------------------
const file = process.argv[2] || process.env.REVENUE_FILE;
const orders = file ? fetchFromFile(file) : await fetchFromCrm();

const conn = db();
const upsert = conn.prepare(`
  INSERT INTO revenue (order_id, phone, phone_raw, amount, order_date, package, status, raw, synced_at)
  VALUES (?,?,?,?,?,?,?,?,?)
  ON CONFLICT (order_id) DO UPDATE SET
    phone=excluded.phone, phone_raw=excluded.phone_raw, amount=excluded.amount,
    order_date=excluded.order_date, package=excluded.package, status=excluded.status,
    raw=excluded.raw, synced_at=excluded.synced_at`);

const now = new Date().toISOString();
let upserted = 0, skippedNoPhone = 0;

conn.exec('BEGIN');
try {
  for (const o of orders) {
    const phone = normalizePhone(o.phone);
    if (!phone) { skippedNoPhone++; continue; }
    upsert.run(
      o.order_id, phone, o.phone == null ? null : String(o.phone),
      Number(o.amount) || 0, o.order_date || null, o.package || null,
      o.status || null, JSON.stringify(o.raw ?? o), now);
    upserted++;
  }
  conn.exec('COMMIT');
} catch (e) {
  conn.exec('ROLLBACK');
  throw e;
}

conn.prepare(`INSERT INTO ingest_log (source, ran_at, detail) VALUES (?,?,?)`)
  .run('revenue', now, JSON.stringify({ source: file || 'crm', upserted, skippedNoPhone }));

// How much revenue actually joins to a known lead?
const joined = conn.prepare(`
  SELECT COUNT(*) orders, ROUND(COALESCE(SUM(amount),0)) amount FROM revenue
  WHERE phone IN (SELECT phone FROM leads)`).get();
const allRev = conn.prepare(`SELECT COUNT(*) orders, ROUND(COALESCE(SUM(amount),0)) amount FROM revenue`).get();
console.log(`\nUpserted ${upserted} orders (${skippedNoPhone} skipped — no/invalid phone)`);
console.log(`Revenue joining to a lead: ${joined.orders}/${allRev.orders} orders, ` +
  `${Number(joined.amount).toLocaleString()} / ${Number(allRev.amount).toLocaleString()} VND`);
close();
