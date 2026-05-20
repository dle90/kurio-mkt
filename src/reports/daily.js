// Daily standup report. Pulls fresh Meta daily insights (campaign level) and
// fresh Getfly orders for a 3-day window, then reports:
//   - Yesterday: total spend, total reg, total revenue booked
//   - Per-campaign yesterday: spend / reg / CPR (+ historical ROAS for context)
//   - What is running today (campaigns with spend so far)
//   - Roster flags vs FINDINGS.md guidance
//
// Usage:  node src/reports/daily.js            (yesterday = today-1)
//         REPORT_DATE=2026-05-19 node src/reports/daily.js
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';
import { getfly } from '../getfly/client.js';
import { attributeOrders } from '../getfly/attribute_orders.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
  { id: 'act_1069029708221793', name: 'Kurio 5' },
];

const iso = d => d.toISOString().slice(0, 10);
const TODAY = process.env.REPORT_TODAY || iso(new Date());
const YDAY  = process.env.REPORT_DATE || iso(new Date(Date.parse(TODAY) - 86400_000));
const DBEFORE = iso(new Date(Date.parse(YDAY) - 86400_000));

const REG_TYPE = 'complete_registration';
const fmt = n => Math.round(n).toLocaleString('en-US');

// ---------- 1. Meta: daily campaign insights ----------
async function fetchMeta() {
  const rows = [];
  for (const acc of ACCOUNTS) {
    let r;
    try {
      r = await meta.getAll(`/${acc.id}/insights`, {
        level: 'campaign',
        fields: 'campaign_id,campaign_name,objective,spend,impressions,clicks,actions',
        time_range: { since: DBEFORE, until: TODAY },
        time_increment: 1,
        limit: 500,
      });
    } catch (e) { console.error(`  ${acc.name} insights ERROR: ${e.message}`); continue; }
    for (const x of r) {
      const reg = (x.actions || []).find(a => a.action_type === REG_TYPE)?.value || 0;
      rows.push({
        account: acc.name,
        date: x.date_start,
        campaign_id: x.campaign_id,
        campaign: x.campaign_name,
        objective: x.objective,
        spend: +x.spend || 0,
        impressions: +x.impressions || 0,
        clicks: +x.clicks || 0,
        reg: +reg || 0,
      });
    }
    console.error(`  ${acc.name}: ${r.length} campaign-day rows`);
  }
  return rows;
}

// ---------- 2. Getfly: orders in window ----------
async function fetchOrders() {
  const FIELDS = 'id,order_code,account_phone,real_amount,status,status_label,created_at';
  const out = [];
  let offset = 0;
  while (true) {
    const r = await getfly.get('/sale_orders', { limit: 200, offset, fields: FIELDS });
    const data = r?.data || [];
    if (!data.length) break;
    let stop = false;
    for (const rec of data) {
      const d = (rec.created_at || '').slice(0, 10);
      if (d && d < DBEFORE) { stop = true; break; }
      if (d && d <= TODAY) out.push(rec);
    }
    if (stop || !r.has_more) break;
    offset += data.length;
    if (offset > 30000) break;
  }
  return out;
}

const main = async () => {
  console.error(`Daily report — yesterday=${YDAY}, today=${TODAY}\n`);
  console.error('Fetching Meta daily insights...');
  const meta3d = await fetchMeta();
  console.error('Fetching Getfly orders...');
  const orders = await fetchOrders();
  console.error(`  ${orders.length} orders in ${DBEFORE}..${TODAY}\n`);

  // persist raw for reuse
  fs.writeFileSync('.cache/daily_meta.json', JSON.stringify(meta3d, null, 2));
  fs.writeFileSync('.cache/daily_orders.json', JSON.stringify(orders, null, 2));

  // ----- revenue by day (approved orders) -----
  const revByDay = {}, ordCntByDay = {};
  for (const o of orders) {
    if (o.status !== 2) continue;          // approved only
    const amt = +o.real_amount || 0;
    if (amt <= 0) continue;
    const d = (o.created_at || '').slice(0, 10);
    revByDay[d] = (revByDay[d] || 0) + amt;
    ordCntByDay[d] = (ordCntByDay[d] || 0) + 1;
  }

  // ----- attribute YESTERDAY's orders to ad codes via Getfly ads_code -----
  console.error('Attributing yesterday\'s orders via Getfly ads_code...');
  const ydayOrders = orders.filter(o => o.status === 2 &&
    (o.created_at || '').slice(0, 10) === YDAY && (+o.real_amount || 0) > 0);
  const attrib = await attributeOrders(ydayOrders);
  fs.writeFileSync(`.cache/order_attrib_${YDAY}.json`, JSON.stringify(attrib, null, 2));
  const revByCodeYday = new Map();   // ad code -> revenue
  const revByBucket = new Map();     // ad / renewal / organic-page / other / no-account
  for (const r of attrib) {
    revByBucket.set(r.bucket, (revByBucket.get(r.bucket) || 0) + r.amount);
    if (r.ads_code) revByCodeYday.set(r.ads_code, (revByCodeYday.get(r.ads_code) || 0) + r.amount);
  }
  const adRev = revByBucket.get('ad') || 0;

  // ----- per-campaign aggregation per day -----
  const dayAgg = {};   // date -> {spend,reg,imp}
  const campDay = {};  // date -> Map(campaign -> {spend,reg,imp,clicks,objective,account})
  for (const r of meta3d) {
    const D = dayAgg[r.date] || (dayAgg[r.date] = { spend: 0, reg: 0, imp: 0 });
    D.spend += r.spend; D.reg += r.reg; D.imp += r.impressions;
    const cm = campDay[r.date] || (campDay[r.date] = new Map());
    const c = cm.get(r.campaign) || { spend: 0, reg: 0, imp: 0, clicks: 0, objective: r.objective, account: r.account };
    c.spend += r.spend; c.reg += r.reg; c.imp += r.impressions; c.clicks += r.clicks;
    cm.set(r.campaign, c);
  }

  const line = '='.repeat(72);
  const P = s => console.log(s);

  // ===== YESTERDAY HEADLINE =====
  P(line);
  P(`  YESTERDAY  ${YDAY}`);
  P(line);
  const y = dayAgg[YDAY] || { spend: 0, reg: 0, imp: 0 };
  const yRev = revByDay[YDAY] || 0;
  const cpr = y.reg ? y.spend / y.reg : 0;
  P(`  Ad spend (Meta, all accounts) : ${fmt(y.spend)} VND`);
  P(`  Registrations (complete_reg)  : ${y.reg}`);
  P(`  Blended CPR                   : ${y.reg ? fmt(cpr) + ' VND' : '—'}`);
  P(`  Revenue booked (Getfly appr.) : ${fmt(yRev)} VND   (${ordCntByDay[YDAY] || 0} approved orders)`);
  P(`    └ from a Meta ad code       : ${fmt(adRev)} VND  (${yRev ? Math.round(adRev / yRev * 100) : 0}% — rest is organic/renewal/internal)`);
  P(`  Same-day spend:rev ratio      : ${y.spend ? (yRev / y.spend).toFixed(2) : '—'}  ` +
    `(NB: orders booked today mostly come from past registrations — not a true ROAS)`);
  // day-before comparison
  const yb = dayAgg[DBEFORE];
  if (yb) {
    const cprb = yb.reg ? yb.spend / yb.reg : 0;
    P(`  vs ${DBEFORE}: spend ${fmt(yb.spend)} | reg ${yb.reg} | CPR ${yb.reg ? fmt(cprb) : '—'} | rev ${fmt(revByDay[DBEFORE] || 0)}`);
  }

  // ===== CAMPAIGNS THAT RAN YESTERDAY =====
  P('');
  P(line);
  P(`  CAMPAIGNS THAT RAN ${YDAY}  (spend > 0)`);
  P(line);
  const ranY = [...(campDay[YDAY] || new Map()).entries()]
    .filter(([, c]) => c.spend > 0)
    .sort((a, b) => b[1].spend - a[1].spend);
  P(`  ${'campaign'.padEnd(42)} ${'acct'.padEnd(8)} ${'spend'.padStart(11)} ${'reg'.padStart(4)} ${'CPR'.padStart(9)}`);
  P('  ' + '-'.repeat(78));
  for (const [name, c] of ranY) {
    P('  ' + (name || '(unnamed)').slice(0, 41).padEnd(42) + ' ' +
      c.account.padEnd(8) + ' ' +
      fmt(c.spend).padStart(11) + ' ' +
      String(c.reg).padStart(4) + ' ' +
      (c.reg ? fmt(c.spend / c.reg) : '—').padStart(9));
  }
  P(`  ${ranY.length} campaigns ran. Total spend ${fmt(ranY.reduce((a, [, c]) => a + c.spend, 0))} | ` +
    `reg ${ranY.reduce((a, [, c]) => a + c.reg, 0)}`);
  const zeroReg = ranY.filter(([, c]) => c.reg === 0 && c.spend > 0);
  if (zeroReg.length) {
    P(`  ⚠ ${zeroReg.length} campaigns spent with 0 reg: ` +
      fmt(zeroReg.reduce((a, [, c]) => a + c.spend, 0)) + ' VND');
  }

  // ===== REVENUE BOOKED YESTERDAY — ATTRIBUTED VIA GETFLY ads_code =====
  P('');
  P(`  Revenue booked ${YDAY} — attributed via Getfly ads_code (not the sheet):`);
  const bucketLabel = { ad: 'ad code', renewal: 'renewal (gia hạn)', 'organic-page': 'organic page',
    other: 'other / internal', 'no-account': 'no Getfly account' };
  for (const [b, amt] of [...revByBucket.entries()].sort((a, c) => c[1] - a[1])) {
    P('    ' + (bucketLabel[b] || b).padEnd(22) + fmt(amt).padStart(12) + ' VND  ' +
      `(${yRev ? Math.round(amt / yRev * 100) : 0}%)`);
  }
  P('');
  P(`  Ad-code revenue (${fmt(adRev)} VND) by code:`);
  const revCodes = [...revByCodeYday.entries()].sort((a, b) => b[1] - a[1]);
  for (const [code, amt] of revCodes) {
    P('    ' + code.padEnd(22) + fmt(amt).padStart(12) + ' VND');
  }

  // ===== RUNNING TODAY =====
  P('');
  P(line);
  P(`  RUNNING TODAY  ${TODAY}  (spend so far — partial day)`);
  P(line);
  const ranT = [...(campDay[TODAY] || new Map()).entries()]
    .filter(([, c]) => c.spend > 0)
    .sort((a, b) => b[1].spend - a[1].spend);
  if (!ranT.length) {
    P('  No spend recorded yet today (too early, or insights not yet populated).');
  } else {
    P(`  ${'campaign'.padEnd(42)} ${'acct'.padEnd(8)} ${'spend'.padStart(11)} ${'reg'.padStart(4)}`);
    P('  ' + '-'.repeat(70));
    for (const [name, c] of ranT) {
      P('  ' + (name || '(unnamed)').slice(0, 41).padEnd(42) + ' ' +
        c.account.padEnd(8) + ' ' + fmt(c.spend).padStart(11) + ' ' + String(c.reg).padStart(4));
    }
    P(`  ${ranT.length} campaigns active today. Spend so far ${fmt(ranT.reduce((a, [, c]) => a + c.spend, 0))}`);
  }

  // dropped / added vs yesterday
  const setY = new Set(ranY.map(([n]) => n));
  const setT = new Set(ranT.map(([n]) => n));
  const dropped = [...setY].filter(n => !setT.has(n));
  const added = [...setT].filter(n => !setY.has(n));
  if (ranT.length) {
    P('');
    P(`  Ran yesterday but not today (${dropped.length}): ` + (dropped.slice(0, 8).join('; ') || 'none'));
    P(`  New today (${added.length}): ` + (added.slice(0, 8).join('; ') || 'none'));
  }

  // ===== ROSTER FLAGS =====
  P('');
  P(line);
  P('  ROSTER FLAGS');
  P(line);
  const roster = ranT.length ? ranT : ranY;
  const flagSrc = ranT.length ? `today (${TODAY})` : `yesterday (fallback — no today data)`;
  P(`  Source: ${flagSrc}`);
  let flags = 0;
  for (const [name, c] of roster) {
    const n = (name || '').toLowerCase();
    if (/engage\s*-\s*vtv/.test(n)) {
      P(`  🚨 "${name}" — Engage/VTV brand campaign still live (FINDINGS: pause candidate). spend ${fmt(c.spend)}`);
      flags++;
    } else if (/^mess[_\s]/i.test(name || '') || n.startsWith('mess')) {
      P(`  ⚠ "${name}" — Messenger campaign; judge by cost-per-chat, not CPR. spend ${fmt(c.spend)}`);
      flags++;
    } else if (c.objective === 'OUTCOME_ENGAGEMENT') {
      P(`  ⚠ "${name}" — objective OUTCOME_ENGAGEMENT; not a registration channel. spend ${fmt(c.spend)}`);
      flags++;
    }
  }
  if (!flags) P('  No automatic roster flags (no Engage/VTV, Messenger, or engagement-objective campaigns spending).');

  console.error('\nDone. Raw cached to .cache/daily_meta.json + .cache/daily_orders.json');
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
