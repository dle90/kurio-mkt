// Per-salesperson attribution from Getfly.
//   - Registrations: new /accounts records created in window, grouped by account_manager
//   - Revenue:       approved /sale_orders in window, grouped by assigned_user
//
// Usage:  node src/reports/salesperson.js              (yesterday by default)
//         REPORT_DATE=2026-05-23 node src/reports/salesperson.js
//         DAYS=7 node src/reports/salesperson.js       (rolling N-day window)
import 'dotenv/config';
import { getfly } from '../getfly/client.js';

const iso = d => d.toISOString().slice(0, 10);
const TODAY = process.env.REPORT_TODAY || iso(new Date());
const YDAY  = process.env.REPORT_DATE || iso(new Date(Date.parse(TODAY) - 86400_000));
const DAYS  = Math.max(1, parseInt(process.env.DAYS || '1', 10));
const SINCE = iso(new Date(Date.parse(YDAY) - (DAYS - 1) * 86400_000));
const UNTIL = YDAY;
const fmt = n => Math.round(n).toLocaleString('en-US');

async function paginate(path, fields, { pageSize = 200, stopWhenOlderThan } = {}) {
  const out = [];
  let offset = 0;
  while (true) {
    const r = await getfly.get(path, { limit: pageSize, offset, fields });
    const data = r?.data || [];
    if (!data.length) break;
    let stop = false;
    for (const rec of data) {
      const d = (rec.created_at || '').slice(0, 10);
      if (stopWhenOlderThan && d && d < stopWhenOlderThan) { stop = true; break; }
      out.push(rec);
    }
    if (stop || !r.has_more) break;
    offset += data.length;
    if (offset > 50000) break;
  }
  return out;
}

const main = async () => {
  console.error(`Salesperson report — window ${SINCE} .. ${UNTIL} (${DAYS} day${DAYS > 1 ? 's' : ''})\n`);

  console.error('Fetching /sale_orders ...');
  const orders = await paginate(
    '/sale_orders',
    'id,order_code,account_phone,real_amount,status,created_at,assigned_user,assigned_user_name',
    { stopWhenOlderThan: SINCE },
  );
  console.error(`  ${orders.length} orders fetched in window`);

  console.error('Fetching /accounts ...');
  const accounts = await paginate(
    '/accounts',
    'id,account_name,phone_office,created_at,account_manager,account_source',
    { stopWhenOlderThan: SINCE },
  );
  console.error(`  ${accounts.length} accounts fetched in window`);

  console.error('Fetching /users ...');
  let users = [];
  try {
    const u = await getfly.get('/users', { limit: 200, fields: 'id,contact_name,dept_name,email' });
    users = u?.data || [];
  } catch (e) { console.error('  /users ERR (will fall back to assigned_user_name):', e.message); }
  const userName = new Map();
  for (const u of users) userName.set(u.user_id, u.contact_name || u.email || `user#${u.user_id}`);

  // ---- aggregate revenue by assigned_user ----
  const rev = new Map(); // user_id -> {name, revenue, orders}
  for (const o of orders) {
    const d = (o.created_at || '').slice(0, 10);
    if (d < SINCE || d > UNTIL) continue;
    if (o.status !== 2) continue;          // approved only
    const amt = +o.real_amount || 0;
    if (amt <= 0) continue;
    const uid = o.assigned_user ?? -1;
    const name = o.assigned_user_name || userName.get(uid) || `user#${uid}`;
    const r = rev.get(uid) || { uid, name, revenue: 0, orders: 0 };
    r.revenue += amt; r.orders += 1;
    rev.set(uid, r);
  }

  // ---- aggregate registrations by account_manager ----
  const reg = new Map(); // user_id -> {name, regs, organic_regs}
  for (const a of accounts) {
    const d = (a.created_at || '').slice(0, 10);
    if (d < SINCE || d > UNTIL) continue;
    const uid = a.account_manager ?? -1;
    const name = userName.get(uid) || `user#${uid}`;
    const srcId = Array.isArray(a.account_source) ? a.account_source[0] : null;
    const r = reg.get(uid) || { uid, name, regs: 0, organic_regs: 0 };
    r.regs += 1;
    if (srcId === 7) r.organic_regs += 1;
    reg.set(uid, r);
  }

  // ---- join into one table ----
  const merged = new Map();
  for (const [uid, r] of rev) merged.set(uid, { uid, name: r.name, revenue: r.revenue, orders: r.orders, regs: 0, organic_regs: 0 });
  for (const [uid, r] of reg) {
    const m = merged.get(uid) || { uid, name: r.name, revenue: 0, orders: 0, regs: 0, organic_regs: 0 };
    m.regs = r.regs; m.organic_regs = r.organic_regs;
    if (!m.name || m.name.startsWith('user#')) m.name = r.name;
    merged.set(uid, m);
  }

  const rows = [...merged.values()].sort((a, b) => b.revenue - a.revenue);
  const totRev = rows.reduce((a, r) => a + r.revenue, 0);
  const totOrd = rows.reduce((a, r) => a + r.orders, 0);
  const totReg = rows.reduce((a, r) => a + r.regs, 0);
  const totOrg = rows.reduce((a, r) => a + r.organic_regs, 0);

  const P = s => console.log(s);
  const line = '='.repeat(82);
  P(line);
  P(`  SALESPERSON ATTRIBUTION  ${SINCE} .. ${UNTIL}`);
  P(line);
  P('  ' + 'salesperson'.padEnd(28) + 'uid'.padStart(5) + ' ' +
    'regs'.padStart(6) + ' ' + 'orders'.padStart(7) + ' ' +
    'revenue (VND)'.padStart(16) + ' ' + 'avg/order'.padStart(12));
  P('  ' + '-'.repeat(78));
  for (const r of rows) {
    P('  ' + (r.name || '(unknown)').slice(0, 27).padEnd(28) +
      String(r.uid).padStart(5) + ' ' +
      String(r.regs).padStart(6) + ' ' +
      String(r.orders).padStart(7) + ' ' +
      fmt(r.revenue).padStart(16) + ' ' +
      (r.orders ? fmt(r.revenue / r.orders) : '—').padStart(12));
  }
  P('  ' + '-'.repeat(78));
  P('  ' + 'TOTAL'.padEnd(33) +
    String(totReg).padStart(6) + ' ' +
    String(totOrd).padStart(7) + ' ' +
    fmt(totRev).padStart(16));
  P('');
  P(`  Of ${totReg} new accounts in window, ${totOrg} (${totReg ? Math.round(totOrg / totReg * 100) : 0}%) are organic-page (account_source=7) — typically auto-assigned`);

  console.error('\nDone.');
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
