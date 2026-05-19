// ROAS-by-code report — the payoff of the db. Joins Meta spend, leads, and CRM
// revenue through the short code.
//
//   npm run db:roas                  # all codes with spend, sorted by spend
//   MIN_SPEND=2000000 npm run db:roas # only codes that spent >= 2M VND
//   SORT=roas npm run db:roas         # sort by roas instead of spend
//
// Works incrementally: with only spend ingested it still shows spend / reg /
// CPR; ROAS columns fill in once leads + revenue are loaded.

import { db, close } from '../db/connection.js';

const MIN_SPEND = Number(process.env.MIN_SPEND || 0);
const SORT = process.env.SORT || 'spend';

const conn = db();

const counts = {
  ads: conn.prepare('SELECT COUNT(*) n FROM ads').get().n,
  spendRows: conn.prepare('SELECT COUNT(*) n FROM spend_daily').get().n,
  leads: conn.prepare('SELECT COUNT(*) n FROM leads').get().n,
  revenue: conn.prepare('SELECT COUNT(*) n FROM revenue').get().n,
};
console.log(`DB: ${counts.ads} ads, ${counts.spendRows} ad-day spend rows, ` +
  `${counts.leads} leads, ${counts.revenue} revenue rows\n`);
if (counts.leads === 0) console.log('(no leads ingested yet — run db:ingest-leads)');
if (counts.revenue === 0) console.log('(no revenue ingested yet — run db:ingest-revenue)');
if (counts.leads === 0 || counts.revenue === 0) console.log();

const rows = conn.prepare(`
  SELECT code, spend, registrations, leads, orders, revenue, roas, cpr, lead_to_order
  FROM v_roas_by_code
  WHERE spend >= ?
  ORDER BY ${SORT === 'roas' ? 'roas DESC NULLS LAST' : SORT + ' DESC'}`).all(MIN_SPEND);

const vnd = n => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const x = n => (n == null ? '—' : n.toFixed(2));
const pct = n => (n == null ? '—' : (n * 100).toFixed(0) + '%');

const W = { code: 20, spend: 13, reg: 6, cpr: 11, leads: 7, ord: 6, rev: 14, roas: 7 };
const head =
  'code'.padEnd(W.code) + 'spend'.padStart(W.spend) + 'reg'.padStart(W.reg) +
  'CPR'.padStart(W.cpr) + 'leads'.padStart(W.leads) + 'ord'.padStart(W.ord) +
  'revenue'.padStart(W.rev) + 'ROAS'.padStart(W.roas);
console.log(head);
console.log('-'.repeat(head.length));

for (const r of rows) {
  console.log(
    String(r.code).slice(0, W.code - 1).padEnd(W.code) +
    vnd(r.spend).padStart(W.spend) +
    String(r.registrations).padStart(W.reg) +
    vnd(r.cpr).padStart(W.cpr) +
    String(r.leads).padStart(W.leads) +
    String(r.orders).padStart(W.ord) +
    vnd(r.revenue).padStart(W.rev) +
    x(r.roas).padStart(W.roas));
}

const t = conn.prepare(`
  SELECT ROUND(SUM(spend)) spend, SUM(registrations) reg, SUM(leads) leads,
         SUM(orders) orders, ROUND(SUM(revenue)) revenue
  FROM v_roas_by_code WHERE spend >= ?`).get(MIN_SPEND);
console.log('-'.repeat(head.length));
console.log(
  `TOTAL (${rows.length} codes)`.padEnd(W.code) +
  vnd(t.spend).padStart(W.spend) +
  String(t.reg || 0).padStart(W.reg) +
  vnd(t.reg > 0 ? t.spend / t.reg : null).padStart(W.cpr) +
  String(t.leads || 0).padStart(W.leads) +
  String(t.orders || 0).padStart(W.ord) +
  vnd(t.revenue).padStart(W.rev) +
  x(t.spend > 0 ? (t.revenue || 0) / t.spend : null).padStart(W.roas));

if (t.revenue > 0) {
  console.log(`\nBlended ROAS: ${x((t.revenue || 0) / t.spend)}  ` +
    `· lead→order: ${pct(t.leads > 0 ? t.orders / t.leads : null)}`);
}
close();
