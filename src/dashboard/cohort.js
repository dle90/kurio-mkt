// Cohort revenue analysis — registration cohort = the day a customer's Getfly
// account was created. Two views:
//   A) revenue booked on recent days, decomposed by the age of the cohort it
//      came from  ("today's money — how old is it?")
//   B) each daily registration cohort's cumulative revenue, by age
//      ("how is each cohort ageing, day by day?")
import fs from 'node:fs';
import { normPhone } from '../roas/attribution.js';

const ACCOUNTS = JSON.parse(fs.readFileSync('.cache/getfly_accounts.json', 'utf8'));
const ORDERS = JSON.parse(fs.readFileSync('.cache/getfly_orders_ytd.json', 'utf8'));

const d10 = s => (s || '').slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400_000);
const addDays = (s, n) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const fmtM = n => (n / 1e6).toFixed(1) + 'M';
const TODAY = new Date().toISOString().slice(0, 10);

// phone -> earliest account (created date)
const acct = new Map();
for (const a of ACCOUNTS) {
  if (!a.phone) continue;
  const c = d10(a.created_at);
  if (!c) continue;
  const cur = acct.get(a.phone);
  if (!cur || c < cur.created) acct.set(a.phone, { created: c });
}
// cohort sizes = new customers (first-seen phones) per day
const cohortN = new Map();
for (const [, v] of acct) cohortN.set(v.created, (cohortN.get(v.created) || 0) + 1);

// approved orders -> (cohort, age, amount)
const incRev = new Map();   // cohort -> Map(age -> amount)
const orderRecs = [];       // {bd, cohort|null, age|null, amt}
for (const o of ORDERS) {
  if (o.status !== 2) continue;
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const bd = d10(o.created_at);
  const a = acct.get(normPhone(o.account_phone));
  if (!a) { orderRecs.push({ bd, cohort: null, age: null, amt }); continue; }
  const age = dayDiff(a.created, bd);
  if (age < 0) { orderRecs.push({ bd, cohort: null, age: null, amt }); continue; }
  orderRecs.push({ bd, cohort: a.created, age, amt });
  if (!incRev.has(a.created)) incRev.set(a.created, new Map());
  const m = incRev.get(a.created);
  m.set(age, (m.get(age) || 0) + amt);
}

// =====================================================================
// VIEW A — revenue booked on recent days, by cohort age
// =====================================================================
const buckets = [
  { l: '0d', lo: 0, hi: 0 }, { l: '1d', lo: 1, hi: 1 }, { l: '2d', lo: 2, hi: 2 },
  { l: '3-6d', lo: 3, hi: 6 }, { l: '7-13d', lo: 7, hi: 13 }, { l: '14-29d', lo: 14, hi: 29 },
  { l: '30-89d', lo: 30, hi: 89 }, { l: '90d+', lo: 90, hi: 1e9 },
];
const bDays = [...new Set(orderRecs.map(r => r.bd))].sort();
const recent = bDays.slice(-8);

console.log('='.repeat(94));
console.log('  VIEW A — revenue booked each day, by age of the registration cohort behind it');
console.log('='.repeat(94));
console.log('  ' + 'booked'.padEnd(11) + 'total'.padStart(9) +
  buckets.map(b => b.l.padStart(9)).join('') + '   med.age');
console.log('  ' + '-'.repeat(91));
for (const day of recent) {
  const recs = orderRecs.filter(r => r.bd === day);
  const total = recs.reduce((s, r) => s + r.amt, 0) || 1;
  const cells = buckets.map(b => {
    const v = recs.filter(r => r.cohort && r.age >= b.lo && r.age <= b.hi).reduce((s, r) => s + r.amt, 0);
    return v ? (v / total * 100).toFixed(0).padStart(8) + '%' : '·'.padStart(9);
  });
  // median age weighted by revenue
  const aged = recs.filter(r => r.age != null).flatMap(r => Array(Math.max(1, Math.round(r.amt / 100000))).fill(r.age)).sort((a, b) => a - b);
  const med = aged.length ? aged[Math.floor(aged.length / 2)] : '—';
  const unattr = recs.filter(r => r.cohort == null).reduce((s, r) => s + r.amt, 0);
  console.log('  ' + (day + (day === TODAY ? '*' : '')).padEnd(11) +
    fmtM(total).padStart(9) + cells.join('') + ('  ' + med + 'd').padStart(9) +
    (unattr ? `   (${fmtM(unattr)} no-acct)` : ''));
}
console.log('  * today = partial day. Cells are % of that day\'s booked revenue.');

// =====================================================================
// VIEW B — cohort ageing: cumulative revenue per registration, by age
// =====================================================================
const ages = [0, 1, 2, 3, 5, 7, 10, 14, 21, 30, 45];
const cohorts = [...cohortN.keys()].filter(c => c >= addDays(TODAY, -28) && c <= TODAY).sort();

console.log('');
console.log('='.repeat(94));
console.log('  VIEW B — how each registration cohort ages: cumulative revenue PER registration (000 VND)');
console.log('='.repeat(94));
console.log('  ' + 'cohort'.padEnd(8) + 'regs'.padStart(5) + '  ' +
  ages.map(a => ('d' + a).padStart(6)).join('') + '   rev/reg-now');
console.log('  ' + '-'.repeat(91));
for (const c of cohorts) {
  const n = cohortN.get(c) || 0;
  if (n < 3) continue;
  const m = incRev.get(c) || new Map();
  const obs = dayDiff(c, TODAY);
  let cum = 0;
  const series = [];
  for (let a = 0; a <= 60; a++) cum += (m.get(a) || 0);
  const lifetime = cum;
  // cumulative at each shown age
  const cumAt = age => {
    let s = 0;
    for (let a = 0; a <= age; a++) s += (m.get(a) || 0);
    return s;
  };
  const cells = ages.map(a => {
    if (obs < a) return '·'.padStart(6);
    return Math.round(cumAt(a) / n / 1000).toString().padStart(6);
  });
  console.log('  ' + c.slice(5).padEnd(8) + String(n).padStart(5) + '  ' +
    cells.join('') + '   ' + Math.round(lifetime / n / 1000) + 'k  (age ' + obs + 'd)');
}
console.log('  Read across a row = one cohort filling up. Read down a column = recent vs older');
console.log('  cohorts at the SAME age (quality drift). "·" = cohort not old enough to observe yet.');
